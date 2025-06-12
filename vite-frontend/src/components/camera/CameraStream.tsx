// src/components/CameraStream.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { OverlayMarker } from 'over-lib';
import '../../styles/CameraStream.css';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';

interface CameraStreamProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoWidth: number;
  videoHeight: number;
  cameraReady: boolean;
  quad?: { x: number; y: number }[];
  showOverlayMarker?: boolean;
  onTapSnapshot?: (roiSnapshot: string) => void;
  overlayWidthRatio: number;
  overlayHeightRatio: number;
}

const MIN_ROI_WIDTH = 280;
const MIN_ROI_HEIGHT = 360;

const CameraStream: React.FC<CameraStreamProps> = ({
  canvasRef,
  videoRef,
  cameraReady,
  videoWidth,
  videoHeight,
  quad,
  onTapSnapshot,
  overlayWidthRatio,
  overlayHeightRatio,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [displaySize, setDisplaySize] = useState({ width: videoWidth, height: videoHeight });
  const [showManualQuad, setShowManualQuad] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const aspect = videoHeight / videoWidth;
      const height = width * aspect;
      setDisplaySize({ width, height });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [videoWidth, videoHeight]);

  useEffect(() => {
    if (!canvasRef.current || !cameraReady) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = displaySize;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (quad && quad.length === 4) {
      ctx.strokeStyle = '#f44336';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(quad[0].x, quad[0].y);
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(quad[i].x, quad[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }, [canvasRef, cameraReady, displaySize, quad]);

  const handleManualTap = async () => {
    console.log('[CameraStream] Tap detected, creating snapshot');

    const { width: displayWidth, height: displayHeight } = displaySize;
    const markerWidthPx = displayWidth * overlayWidthRatio;
    const markerHeightPx = displayHeight * overlayHeightRatio;
    console.log(`[CameraStream] Overlay marker size: ${Math.round(markerWidthPx)}×${Math.round(markerHeightPx)} px`);

    setShowManualQuad(true);
    setFlash(true);

    setTimeout(() => setShowManualQuad(false), 2000);
    setTimeout(() => setFlash(false), 120);

    const audio = new Audio('/sounds/shutter.wav');
    audio.volume = 0.45;
    audio.play().catch(() => { });

    const video = videoRef?.current;
    if (!video || !cameraReady) return;

    const actualWidth = video.videoWidth;
    const actualHeight = video.videoHeight;

    let roiWidth = actualWidth * overlayWidthRatio;
    let roiHeight = actualHeight * overlayHeightRatio;

    roiWidth = Math.max(roiWidth, MIN_ROI_WIDTH);
    roiHeight = Math.max(roiHeight, MIN_ROI_HEIGHT);

    roiWidth = Math.min(roiWidth, actualWidth);
    roiHeight = Math.min(roiHeight, actualHeight);

    const roiX = (actualWidth - roiWidth) / 2;
    const roiY = (actualHeight - roiHeight) / 2;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = roiWidth;
    tempCanvas.height = roiHeight;
    const ctx = tempCanvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(video, roiX, roiY, roiWidth, roiHeight, 0, 0, roiWidth, roiHeight);
      const roiSnapshot = tempCanvas.toDataURL('image/jpeg');
      onTapSnapshot?.(roiSnapshot);
    }
  };

  const markerWidthPx = Math.max(displaySize.width * overlayWidthRatio, MIN_ROI_WIDTH);
  const markerHeightPx = Math.max(displaySize.height * overlayHeightRatio, MIN_ROI_HEIGHT);
  const clampedOverlayWidthRatio = markerWidthPx / displaySize.width;
  const clampedOverlayHeightRatio = markerHeightPx / displaySize.height;

  return (
    <Box
      ref={containerRef}
      position="relative"
      width="100%"
      maxWidth="100%"
      sx={{ aspectRatio: `${videoWidth} / ${videoHeight}` }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        crossOrigin="anonymous"
        style={{
          width: `${displaySize.width}px`,
          height: `${displaySize.height}px`,
          objectFit: 'cover',
          display: 'block',
        }}
      />

      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${displaySize.width}px`,
          height: `${displaySize.height}px`,
          pointerEvents: 'none',
        }}
      />

      <OverlayMarker
        width={`${clampedOverlayWidthRatio * 100}%`}
        height={`${clampedOverlayHeightRatio * 100}%`}
        markerColor="white"
        markerThickness={3}
        markerLength="25px"
        perspective
        perspectiveDistance="800px"
        rotateX="50deg"
        rotateY="0deg"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 12,
        }}
      />

      {showManualQuad && (
        <OverlayMarker
          width={`${clampedOverlayWidthRatio * 100}%`}
          height={`${clampedOverlayHeightRatio * 100}%`}
          markerColor="#f44336"
          markerThickness={4}
          markerLength="100%"
          perspective
          perspectiveDistance="800px"
          rotateX="50deg"
          rotateY="0deg"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 11,
          }}
        />
      )}

      {flash && <div className="camera-flash" />}

      <Box
        onClick={handleManualTap}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 12,
          pointerEvents: 'auto',
          cursor: 'pointer',
        }}
      />

      {!cameraReady && (
        <Paper
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.94)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
          }}
        >
          <VideocamOffIcon sx={{ fontSize: 48, color: 'white' }} />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Accessing camera...
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default CameraStream;