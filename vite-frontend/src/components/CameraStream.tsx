import React, { useEffect, useRef, useState } from 'react';
import { Box, Paper, CircularProgress, Typography } from '@mui/material';
import { OverlayMarker } from 'over-lib';

interface CameraStreamProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  videoRef?: React.RefObject<HTMLVideoElement>;
  cameraReady: boolean;
  videoWidth: number;
  videoHeight: number;
  quad?: { x: number; y: number }[] | null;
}

const CameraStream: React.FC<CameraStreamProps> = ({
  canvasRef,
  videoRef,
  cameraReady,
  videoWidth,
  videoHeight,
  quad,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [displaySize, setDisplaySize] = useState({ width: videoWidth, height: videoHeight });

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
    if (!canvasRef.current || !cameraReady || !quad) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = displaySize;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset
    ctx.scale(dpr, dpr);

    if (quad.length === 4) {
      ctx.strokeStyle = 'lime';
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
        width="42%"
        height="84%"
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
            backgroundColor: 'rgba(255,255,255,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <CircularProgress />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Accessing camera...
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default CameraStream;
