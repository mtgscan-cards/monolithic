import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Container
} from '@mui/material';
import useFrameProcessor from '../hooks/useFrameProcessor';
import CameraPanel from '../components/CameraPanel';

const MobileScanPage: React.FC = () => {
  const { session_id } = useParams<{ session_id: string }>();
  const videoRef = useRef<HTMLVideoElement>(null) as React.RefObject<HTMLVideoElement>;
  const canvasRef = useRef<HTMLCanvasElement>(null) as React.RefObject<HTMLCanvasElement>;

  const [status, setStatus] = useState('Initializing camera...');
  const [roiSnapshot, setRoiSnapshot] = useState<string | null>(null);
  const [, setIsUploading] = useState(false);
  const [quad] = useState<[number, number][] | undefined>(undefined);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const lastSeenCardIdRef = useRef<string | null>(null);

useEffect(() => {
  const video = videoRef.current;
  if (!video) return;

  let didAbort = false;
  let localStream: MediaStream | null = null;

  const initCameraWithRetry = async (retries = 3, delay = 400) => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
          },
        });

        if (didAbort) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStream = stream;
        video.srcObject = localStream;
        video.onloadedmetadata = () => {
          setVideoDimensions({
            width: video.videoWidth,
            height: video.videoHeight,
          });
          video.play().then(() => setStatus('Camera ready')).catch(() => {
            setStatus('Error playing video stream');
          });
        };

        return; // ✅ success, exit loop
      } catch (err) {
        console.warn(`Camera attempt ${attempt + 1} failed:`, err);
        if (attempt === retries - 1) {
          setStatus('Failed to access camera. Please refresh or close other apps.');
        } else {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  };

  initCameraWithRetry();

  return () => {
    didAbort = true;
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (video) {
      video.srcObject = null;
    }
  };
}, []);


  useEffect(() => {
    if (!session_id) {
      console.log('[Polling] No session_id provided, skipping polling.');
      return;
    }

    let active = true;

    const interval = setInterval(async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const pollUrl = `${apiUrl}/api/mobile-infer/result/${session_id}`;
      try {
        console.log(`[Polling] Fetching scan result from: ${pollUrl}`);
        const res = await fetch(pollUrl, {
          credentials: 'include',
        });

        console.log(`[Polling] Response status: ${res.status}`);

        if (res.status === 403) {
          setStatus('Session expired. Please return and restart scan.');
          console.warn('[Polling] Session expired (403). Stopping polling.');
          clearInterval(interval);
          return;
        }

        if (res.status === 404) {
          setStatus('Session not found.');
          console.warn('[Polling] Session not found (404). Stopping polling.');
          clearInterval(interval);
          return;
        }

        const data = await res.json();
        console.log('[Polling] Response data:', data);

        if (active && data?.completed && data.result) {
          const cardId = data.result.predicted_card_id;
          setStatus(`Last Matched: ${data.result.predicted_card_name}`);
          lastSeenCardIdRef.current = cardId;
          console.log(`[Polling] Match found: ${data.result.predicted_card_name} (ID: ${cardId})`);
        } else if (active && data?.completed && !data.result) {
          console.log('[Polling] Scan completed but no result found.');
        } else if (active) {
          console.log('[Polling] Scan not completed yet.');
        }
      } catch (err) {
        console.error('[Polling] Error polling scan result:', err);
        setStatus('Error polling scan result');
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
      console.log('[Polling] Polling stopped/cleaned up.');
    };
  }, [session_id]);

  useFrameProcessor({
    videoRef,
    canvasRef,
    setStatus,
    setInferenceResult: () => { },
    setRoiSnapshot: () => { },
    onScannedCard: () => { },
    onValidROI: async (roiCanvas) => {
      if (!session_id) return;

      const now = Date.now();
      if (now - lastScanTimeRef.current < 3000) {
        setStatus('Cooldown: Please wait a moment before scanning again.');
        return;
      }
      lastScanTimeRef.current = now;

      const preview = roiCanvas.toDataURL('image/jpeg');
      setRoiSnapshot(preview);
      setIsUploading(true);

      const blob = await new Promise<Blob>((resolve) =>
        roiCanvas.toBlob((b: Blob | null) => resolve(b!), 'image/jpeg')
      );

      const formData = new FormData();
      formData.append('roi_image', blob, 'roi.jpg');

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiUrl}/api/mobile-infer/submit/${session_id}`, {
          method: 'POST',
          body: formData,
        });

        const json = await res.json();

        if (res.ok) {
          setStatus('Scan sent successfully! Awaiting match...');
        } else {
          setStatus(`Upload error: ${json.error || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('Upload failed:', err);
        setStatus('Upload failed');
      } finally {
        setIsUploading(false);
      }
    },
  });

  return (
    <Container maxWidth="sm" sx={{ py: 2 }}>
      <Typography variant="h5" align="center" gutterBottom>
        Mobile Card Scanner
      </Typography>
      <Typography variant="body2" align="center" mb={2}>
        Point your phone at a MTG card then tap to scan it.
      </Typography>

      <Box
        sx={{
          width: '100%',
          borderBottom: '2px solid',
          borderColor: 'divider',
          my: { xs: 2, md: 3 },
          borderRadius: 1,
          opacity: 0.7,
        }}
      />

      <Box sx={{ width: '100%', height: videoDimensions ? `${videoDimensions.height * (videoDimensions.width / videoDimensions.width)}px - 90` : 'auto', position: 'relative', mb: 1 }}>
        <CameraPanel
          canvasRef={canvasRef}
          videoRef={videoRef}
          videoWidth={videoDimensions?.width || 640}
          videoHeight={videoDimensions?.height || 480}
          cameraReady={true}
          status={status}
          quad={quad}
        />
      </Box>

      <Box
        sx={{
          width: '100%',
          borderBottom: '2px solid',
          borderColor: 'divider',
          my: { xs: 2, md: 3 },
          borderRadius: 1,
          opacity: 0.7,
        }}
      />

      {roiSnapshot && (
  <Box sx={{ mt: 1, mb: 1, textAlign: 'center' }}>
    <Typography variant="subtitle2">ROI Preview</Typography>
    <Box
      component="img"
      src={roiSnapshot}
      alt="ROI Snapshot"
      sx={{
        width: '100%',
        maxWidth: 160,
        height: 'auto',
        borderRadius: 1,
        mt: 1,
      }}
    />
  </Box>
)}


    </Container>
  );
};

export default MobileScanPage;