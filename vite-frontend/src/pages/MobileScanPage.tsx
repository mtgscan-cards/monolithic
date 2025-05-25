import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Container,
  Card,
} from '@mui/material';
import useFrameProcessor from '../hooks/useFrameProcessor';
import CameraStream from '../components/CameraStream';

const MobileScanPage: React.FC = () => {
  const { session_id } = useParams<{ session_id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [status, setStatus] = useState('Initializing camera...');
  const [roiSnapshot, setRoiSnapshot] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [quad] = useState<{ x: number; y: number }[] | null>(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });
  const lastScanTimeRef = useRef<number>(0);
  const lastSeenCardIdRef = useRef<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          setVideoDimensions({
            width: video.videoWidth,
            height: video.videoHeight,
          });
        };
        return video.play();
      })
      .then(() => setStatus('Camera ready'))
      .catch((err) => {
        console.error('Camera error:', err);
        setStatus('Error accessing camera');
      });

    return () => {
      if (video?.srcObject instanceof MediaStream) {
        video.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!session_id) return;

    let active = true;

    const interval = setInterval(async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      try {
        const res = await fetch(`${apiUrl}/api/mobile-infer/result/${session_id}`, {
          credentials: 'include',
        });

        if (res.status === 403) {
          setStatus('Session expired. Please return and restart scan.');
          clearInterval(interval);
          return;
        }

        if (res.status === 404) {
          setStatus('Session not found.');
          clearInterval(interval);
          return;
        }

        const data = await res.json();

      if (active && data?.completed && data.result) {
        const cardId = data.result.predicted_card_id;

        // Always update status with latest scan result (even if duplicate)
        setStatus(`Last Matched: ${data.result.predicted_card_name}`);

        // Optionally update lastSeenCardIdRef if still needed for UI
        lastSeenCardIdRef.current = cardId;
      }
      } catch (err) {
        console.error("Polling error:", err);
        setStatus('Error polling scan result');
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [session_id]);
  
  useFrameProcessor({
    videoRef,
    canvasRef,
    setStatus,
    setInferenceResult: () => {},
    setRoiSnapshot: () => {},
    setScannedCards: () => {},
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
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h5" align="center" gutterBottom>
        Mobile Card Scanner
      </Typography>
      <Typography variant="body2" align="center" mb={2}>
        Point your phone at a Magic card. It will scan automatically.
      </Typography>

      <Card
        elevation={4}
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '3 / 2',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          mb: 2,
        }}
      >
        <CameraStream
          canvasRef={canvasRef}
          videoRef={videoRef}
          cameraReady={true}
          videoWidth={videoDimensions.width}
          videoHeight={videoDimensions.height}
          quad={quad}
        />
        <video ref={videoRef} style={{ display: 'none' }} />
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: 'white',
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
          }}
        >
          <Typography variant="caption">{status}</Typography>
        </Box>
      </Card>

      {roiSnapshot && (
        <Box sx={{ mb: 2, textAlign: 'center' }}>
          <Typography variant="subtitle2">ROI Preview</Typography>
          <img
            src={roiSnapshot}
            alt="ROI Snapshot"
            style={{ width: 128, height: 128 }}
          />
        </Box>
      )}

      <Box sx={{ textAlign: 'center' }}>
        {isUploading ? (
          <CircularProgress />
        ) : (
          <Typography align="center" color="textSecondary">
            {status}
          </Typography>
        )}
      </Box>

      <Box textAlign="center" mt={2}>
        <Button onClick={() => navigate('/')} color="secondary">
          Cancel and return
        </Button>
      </Box>
    </Container>
  );
};

export default MobileScanPage;