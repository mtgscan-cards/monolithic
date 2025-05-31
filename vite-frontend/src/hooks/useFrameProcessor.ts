import { useEffect, useRef } from 'react';
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
import { createFrameWorker } from '../workers/frameWorkerSingleton';

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
  cardId: string;
  collectorNumber: string;
}

const FOCUS_THRESHOLD = 98;
const CONFIDENCE_THRESHOLD = 0.83;
const REQUIRED_CONSECUTIVE_FRAMES = 5;
const SKIP_FRAMES = 3;
const WINDOW_SIZE = 10; // Number of frames to consider for validation
const MIN_FRAME_INTERVAL_MS = 1000 / 30; // e.g., max 5 FPS


interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  setStatus: (s: string) => void;
  setRoiSnapshot: (dataUrl: string | null) => void;
  setInferenceResult: (r: InferenceResult | null) => void;
  onValidROI?: (roiCanvas: HTMLCanvasElement) => void;
  onScannedCard?: (card: ScannedCard) => void;
  
}

const useFrameProcessor = ({
  videoRef,
  canvasRef,
  setStatus,
  setRoiSnapshot,
  setInferenceResult,
  onValidROI,
  onScannedCard,
}: Props) => {
  const lastProcessTimeRef = useRef<number>(0);
  const raf = useRef(0);
  const offCanvas = useRef<HTMLCanvasElement | null>(null);
  const infCanvas = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const modelLoadedRef = useRef(false);
  const inferRunningRef = useRef(false);

  const frameSkipRef = useRef(0);
  const validBuffer = useRef<boolean[]>([]);
  const cooldownRef = useRef(false);
  const highlightRef = useRef<[number, number][] | null>(null);


  const audioCtxRef = useRef<AudioContext>(
    new (
      window.AudioContext ||
      // @ts-expect-error: webkitAudioContext is not in the standard Window type
      (window as Window & typeof globalThis).webkitAudioContext
    )()
  );

  const playChord = (amt: number) => {
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    const root = Math.min(Math.max(200 * 2 ** (amt / 50), 200), 2000);
    const ratios = [1, 1.25, 1.5];

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(0.2, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    master.connect(ctx.destination);

    ratios.forEach((r, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = root * r;
      osc.detune.value = (i - 1) * 5;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;

      const pan = ctx.createStereoPanner();
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
useEffect(() => {
  offCanvas.current = document.createElement('canvas');
  infCanvas.current = document.createElement('canvas');
  infCanvas.current.width = TARGET_SIZE;
  infCanvas.current.height = TARGET_SIZE;

  const interval = setInterval(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || workerRef.current) return;

    // ✅ Create and initialize the worker *after* camera is ready
    const worker = createFrameWorker(); // changed from getFrameWorker()
    workerRef.current = worker;

    modelLoadedRef.current = false;
    inferRunningRef.current = false;

    worker.postMessage({ type: 'loadModel' });
    setStatus('Loading TFJS model...');

    worker.onmessage = (e: MessageEvent) => {
  const { type, confidences, coords, scale, cropX, cropY } = e.data;

  if (type === 'model-loaded') {
    modelLoadedRef.current = true;
    setStatus('Model loaded');
    return;
  }

  if (type !== 'result') return;
  inferRunningRef.current = false;

  const video = videoRef.current!;
  const minConf = Math.min(...confidences);
  const quad = coords.map(([x, y]: [number, number]) =>
    uncropPoint([x, y], scale, cropX, cropY)
  );

  let valid = false;
  const validROI = isROIValid(quad, video.videoWidth, video.videoHeight);
  const centered = isQuadCentered(quad, video.videoWidth, video.videoHeight);

  if (minConf < CONFIDENCE_THRESHOLD) {
    setStatus(`Low confidence (${minConf.toFixed(2)})`);
  } else if (!validROI) {
    setStatus('Invalid corners');
  } else if (!centered) {
    setStatus('Card not centered');
  } else {
    const roi = getROICanvas(quad, offCanvas.current!);
    if (roi) {
      const score = computeFocusScore(roi);
      if (score < FOCUS_THRESHOLD) {
        setStatus(`Focus too low (${score.toFixed(1)})`);
      } else {
        valid = true;
        setStatus('Valid frame');
        if (onValidROI) onValidROI(roi);
      }
    } else {
      setStatus('ROI extraction failed');
    }
  }

  const canvas = canvasRef.current!;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (highlightRef.current) {
    ctx.strokeStyle = 'lime';
    ctx.lineWidth = 4;
    ctx.beginPath();
    highlightRef.current.forEach(([x, y]: [number, number], i: number) =>
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    );
    ctx.closePath();
    ctx.stroke();
  } else if (centered) {
    ctx.strokeStyle = '#f44336';
    ctx.lineWidth = 3;
    ctx.beginPath();
    quad.forEach(([x, y]: [number, number], i: number) =>
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    );
    ctx.closePath();
    ctx.stroke();
  }

  validBuffer.current.push(valid);
  if (validBuffer.current.length > WINDOW_SIZE) validBuffer.current.shift();

  if (
    validBuffer.current.filter(Boolean).length >= REQUIRED_CONSECUTIVE_FRAMES &&
    !cooldownRef.current
  ) {
    cooldownRef.current = true;
    setTimeout(() => (cooldownRef.current = false), 2000);

    highlightRef.current = quad;
    setTimeout(() => (highlightRef.current = null), 1000);

    const ic = infCanvas.current!;
    const roi = getROICanvas(quad, offCanvas.current!)!;
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

          if (onScannedCard) {
            onScannedCard({
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
              hasFoil: res.finishes.includes('foil') && res.prices.usd_foil != null,
              cardId: res.predicted_card_id!,
              collectorNumber: res.collector_number?.replace(/^0+/, '') || '',
            });
          }
        }
      })
      .catch(err => {
        console.error(err);
        setStatus('Backend error');
      });
  }
};
  }, 100);

  return () => clearInterval(interval);
}, [
  videoRef,
  canvasRef,
  setStatus,
  setRoiSnapshot,
  setInferenceResult,
  onValidROI,
  onScannedCard,
]);




useEffect(() => {
  raf.current = requestAnimationFrame(function loop() {
    const now = performance.now();

    if (now - lastProcessTimeRef.current >= MIN_FRAME_INTERVAL_MS) {
      lastProcessTimeRef.current = now;

      const video = videoRef.current;
      if (video && video.videoWidth !== 0) {
        frameSkipRef.current++;
        if (frameSkipRef.current % (SKIP_FRAMES + 1) === 0) {
          const off = offCanvas.current!;
          off.width = video.videoWidth;
          off.height = video.videoHeight;
          const ctx = off.getContext('2d')!;
          ctx.drawImage(video, 0, 0);

          const { canvas: crop, scale, cropX, cropY } = scaleAndCropImage(off, TARGET_SIZE, TARGET_SIZE);
          createImageBitmap(crop).then(bitmap => {
            workerRef.current?.postMessage(
              { type: 'infer', bitmap, scale, cropX, cropY },
              [bitmap]
            );
          });
        }
      }
    }

    raf.current = requestAnimationFrame(loop);
  });

  return () => cancelAnimationFrame(raf.current);
}, [videoRef]);

  return null;
};

export default useFrameProcessor;