import React, { useEffect } from 'react';
import { Box, Paper, CircularProgress, Typography } from '@mui/material';
import { OverlayMarker } from 'over-lib';

interface CameraStreamProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  videoRef?: React.RefObject<HTMLVideoElement | null>; // Optional if used internally
  cameraReady: boolean;
  videoWidth: number;
  videoHeight: number;
  quad?: { x: number; y: number }[] | null;
}

const CameraStream: React.FC<CameraStreamProps> = ({
  canvasRef,
  cameraReady,
  videoWidth,
  videoHeight,
}) => {
  useEffect(() => {
    if (!canvasRef.current || !cameraReady) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = videoWidth * dpr;
    canvas.height = videoHeight * dpr;
    canvas.style.width = `${videoWidth}px`;
    canvas.style.height = `${videoHeight}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform before scaling
    ctx.scale(dpr, dpr);

    // Optionally draw quad if embedded in canvasRef as a property
    type CanvasWithQuad = HTMLCanvasElement & { quad?: { x: number; y: number }[] };
    const quad: { x: number; y: number }[] | undefined = (canvas as CanvasWithQuad).quad;
    if (quad && quad.length === 4) {
      ctx.strokeStyle = 'lime';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(quad[0].x, quad[0].y);
      ctx.lineTo(quad[1].x, quad[1].y);
      ctx.lineTo(quad[2].x, quad[2].y);
      ctx.lineTo(quad[3].x, quad[3].y);
      ctx.closePath();
      ctx.stroke();
    }
  }, [canvasRef, cameraReady, videoWidth, videoHeight]);

  return (
    <Box position="relative">
      <canvas
        ref={canvasRef}
        style={{
          width: `${videoWidth}px`,
          height: `${videoHeight}px`,
          display: 'block',
        }}
      />
      <OverlayMarker
        width="250px"
        height="350px"
        markerColor="white"
        markerThickness={3}
        markerLength="25px"
        perspective={true}
        perspectiveDistance="800px"
        rotateX="50deg"
        rotateY="0deg"
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
