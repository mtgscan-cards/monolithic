// src/hooks/useFrameProcessor.ts
import { useEffect, useCallback, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import {
  scaleAndCropImage,
  uncropPoint,
  getROICanvas,
  computeFocusScore,
  isQuadCentered,
  isROIValid,
  TARGET_SIZE,
} from '../scanner/imageProcessing';
import { InferenceResult, sendROIToBackend } from '../scanner/backendService';

export interface ScannedCard {
  id: string;
  name: string;
  finishes: string[];
  set: string;
  setName: string;
  prices: { normal: string | null; foil: string | null };
  imageUri: string;
  foil: boolean;
  quantity: number;
  hasFoil: boolean;
  cardId: string; // ← changed from number to string
  collectorNumber: string;
}

const FOCUS_THRESHOLD = 100;
const CONFIDENCE_THRESHOLD = 0.8;       // new: minimum per-keypoint confidence lower means more lenient
const REQUIRED_CONSECUTIVE_FRAMES = 6;
const SKIP_FRAMES = 1;
const WINDOW_SIZE = 8;

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  setStatus: (s: string) => void;
  setRoiSnapshot: (dataUrl: string | null) => void;
  setInferenceResult: (r: InferenceResult | null) => void;
  setScannedCards: React.Dispatch<React.SetStateAction<ScannedCard[]>>;
  onValidROI?: (roiCanvas: HTMLCanvasElement) => void; // <-- newly added
}

const useFrameProcessor = ({
  videoRef,
  canvasRef,
  setStatus,
  setRoiSnapshot,
  setInferenceResult,
  setScannedCards,
  onValidROI,
}: Props) => {
  const modelRef = useRef<tf.GraphModel | null>(null);
  const modelLoaded = useRef(false);

  const frameSkipRef = useRef(0);
  const validBuffer = useRef<boolean[]>([]);
  const cooldownRef = useRef(false);
  const raf = useRef(0);

  // ─── Highlight flash on successful scan ──────────────────────────────────
  const highlightRef = useRef<[number, number][] | null>(null);

  const offCanvas = useRef<HTMLCanvasElement | null>(null);
  const infCanvas = useRef<HTMLCanvasElement | null>(null);

  // ─── Audio setup ────────────────────────────────────────────────────────────
  const audioCtxRef = useRef<AudioContext>(
    new (window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext)()
  );

  const playChord = (amt: number) => {
    const audioCtx = audioCtxRef.current;
    const now = audioCtx.currentTime;
    const root = Math.min(Math.max(200 * 2 ** (amt / 50), 200), 2000);
    const ratios = [1, 1.25, 1.5];

    const master = audioCtx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(0.2, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    master.connect(audioCtx.destination);

    ratios.forEach((ratio, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = root * ratio;
      osc.detune.value = (i - 1) * 5;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;

      const pan = audioCtx.createStereoPanner();
      pan.pan.value = (i - 1) * 0.4;

      osc.connect(filter);
      filter.connect(pan);
      pan.connect(master);

      osc.start(now);
      osc.stop(now + 1.2);
      osc.onended = () => {
        osc.disconnect();
        filter.disconnect();
        pan.disconnect();
      };
    });
  };

  // ─── Load the TFJS GraphModel ──────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setStatus('Loading TFJS GraphModel…');
      await tf.setBackend('webgl');
      await tf.ready();

      const MODEL_URL = '/web_model/model.json';
      try {
        modelRef.current = await tf.loadGraphModel(MODEL_URL);
        setStatus('Model loaded');
        modelLoaded.current = true;
      } catch (err) {
        console.error('Failed to load GraphModel', err);
        setStatus('Error loading model');
      }
    };
    load();
  }, [setStatus]);

  // ─── Prepare offscreen canvases ────────────────────────────────────────────
  useEffect(() => {
    offCanvas.current = document.createElement('canvas');
    infCanvas.current = document.createElement('canvas');
    infCanvas.current.width = TARGET_SIZE;
    infCanvas.current.height = TARGET_SIZE;
  }, []);

  const process = useCallback(async () => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !modelLoaded.current ||
      !modelRef.current
    ) {
      raf.current = requestAnimationFrame(process);
      return;
    }

    const video = videoRef.current;
    if (video.videoWidth === 0) {
      raf.current = requestAnimationFrame(process);
      return;
    }

    // ─── Frame skipping ──────────────────────────────────────────────────────
    frameSkipRef.current++;
    if (frameSkipRef.current % (SKIP_FRAMES + 1) !== 0) {
      raf.current = requestAnimationFrame(process);
      return;
    }

    // ─── Draw to offscreen ───────────────────────────────────────────────────
    const off = offCanvas.current!;
    off.width = video.videoWidth;
    off.height = video.videoHeight;
    const offCtx = off.getContext('2d')!;
    offCtx.drawImage(video, 0, 0);

    // ─── Crop & scale ───────────────────────────────────────────────────────
    const { canvas: crop, scale, cropX, cropY } = scaleAndCropImage(
      off,
      TARGET_SIZE,
      TARGET_SIZE
    );
    const x = tf.tidy(() =>
      tf.browser
        .fromPixels(crop)
        .toFloat()
        .div(tf.scalar(255))
        .expandDims(0)
    );

    // ─── Inference via GraphModel ────────────────────────────────────────────
    const [heatmaps, coordsT] = modelRef.current.execute(x) as tf.Tensor[];

    // ─── Extract per-keypoint confidences ────────────────────────────────────
    const heat = heatmaps.squeeze();                      // [H,W,K]
    const confTensor = heat.max([0, 1]) as tf.Tensor1D;    // [K]
    const confidences = confTensor.arraySync() as number[];
    const minConf = Math.min(...confidences);
    // clean up heatmap tensors
    tf.dispose([heatmaps, heat, confTensor]);

    // ─── Map back to original frame coords ────────────────────────────────────
    const coordsArr = (coordsT.squeeze().arraySync() as number[][]) as [
      number,
      number
    ][];
    tf.dispose(coordsT);
    const quad = coordsArr.map(pt => uncropPoint(pt, scale, cropX, cropY));

    // ─── ROI & focus & confidence logic ──────────────────────────────────────
    let valid = false;
    const validROI = isROIValid(quad, video.videoWidth, video.videoHeight);
    const centered =
      validROI &&
      isQuadCentered(quad, video.videoWidth, video.videoHeight);

  if (minConf < CONFIDENCE_THRESHOLD) {
    setStatus(`Low keypoint confidence (${minConf.toFixed(2)})`);
  } else if (!validROI) {
    setStatus('Quadrilateral ambiguous');
  } else if (!centered) {
    setStatus('Not centered');
  } else {
    const roi = getROICanvas(quad, off);
    if (!roi) {
      setStatus('Cannot extract ROI');
    } else {
      const score = computeFocusScore(roi);
      if (score < FOCUS_THRESHOLD) {
        setStatus(`Focus too low (${score.toFixed(1)})`);
      } else {
        valid = true;
        setStatus('Valid frame');
        if (onValidROI) {
          onValidROI(roi); // ✅ pass the canvas to the mobile inference uploader
        }
      }
    }
  }


    // ─── Draw overlay ────────────────────────────────────────────────────────
    const canvas = canvasRef.current!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (highlightRef.current) {
      // draw green highlight for 1 second
      ctx.strokeStyle = 'lime';
      ctx.lineWidth = 4;
      ctx.beginPath();
      highlightRef.current.forEach(([X, Y], i) =>
        i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y)
      );
      ctx.closePath();
      ctx.stroke();
    } else if (centered) {
      // normal red outline when centered
      ctx.strokeStyle = '#f44336';
      ctx.lineWidth = 3;
      ctx.beginPath();
      quad.forEach(([X, Y], i) =>
        i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y)
      );
      ctx.closePath();
      ctx.stroke();
    }

    // ─── Rolling window & snapshot logic ─────────────────────────────────────
    validBuffer.current.push(valid);
    if (validBuffer.current.length > WINDOW_SIZE) {
      validBuffer.current.shift();
    }

    if (
      validBuffer.current.filter(Boolean).length >=
        REQUIRED_CONSECUTIVE_FRAMES &&
      !cooldownRef.current
    ) {
      cooldownRef.current = true;
      setTimeout(() => {
        cooldownRef.current = false;
      }, 2000);

      // flash highlight
      highlightRef.current = quad;
      setTimeout(() => {
        highlightRef.current = null;
      }, 1000);

      const ic = infCanvas.current!;
      const roi = getROICanvas(quad, off)!;
      const ctx2 = ic.getContext('2d')!;
      ctx2.clearRect(0, 0, TARGET_SIZE, TARGET_SIZE);
      ctx2.drawImage(roi, 0, 0, TARGET_SIZE, TARGET_SIZE);

      const url = ic.toDataURL();
      setRoiSnapshot(url);
      setStatus('Snapshot taken');
      validBuffer.current = [];

      sendROIToBackend(url)
        .then(res => {
          if (!res.predicted_card_id) {
            setStatus('No match');
            setInferenceResult(null);
          } else {
            setInferenceResult(res);
            setStatus(`Found ${res.predicted_card_name}`);

            const priceStr =
              res.prices.usd_foil && res.finishes.includes('foil')
                ? res.prices.usd_foil
                : res.prices.usd;
            const price = priceStr ? parseFloat(priceStr) : 0;
            playChord(price);

            setScannedCards(prev => {
              const idx = prev.findIndex(c => c.id === res.predicted_card_id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx].quantity++;
                return next;
              }
              return [
                ...prev,
                {
                  id: res.predicted_card_id!,
                  name: res.predicted_card_name,
                  finishes: res.finishes,
                  set: res.set,
                  setName: res.set_name,
                  prices: {
                    normal: res.prices.usd,
                    foil: res.prices.usd_foil,
                  },
                  imageUri: res.image_uris.normal,
                  foil: false,
                  quantity: 1,
                  hasFoil:
                    res.finishes.includes('foil') &&
                    res.prices.usd_foil != null,
                    cardId: res.predicted_card_id!, // ← Make sure this exists in the backend response
                  collectorNumber: res.collector_number?.replace(/^0+/, '') || '',
                },
              ];
            });
          }
        })
        .catch(err => {
          console.error(err);
          setStatus('Backend error');
        });
    }

    raf.current = requestAnimationFrame(process);
  }, [videoRef, canvasRef, setStatus, onValidROI, setRoiSnapshot, setInferenceResult, setScannedCards]);

  // ─── Kick off loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    raf.current = requestAnimationFrame(process);
    return () => cancelAnimationFrame(raf.current);
  }, [process]);

  return null;
};

export default useFrameProcessor;
