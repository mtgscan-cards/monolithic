// src/components/CameraStream.tsx
import React, { useEffect } from 'react';
import { Box, Paper, CircularProgress, Typography } from '@mui/material';
import { OverlayMarker } from 'over-lib';

interface CameraStreamProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  cameraReady: boolean;
  videoWidth: number;
  videoHeight: number;
}

const CameraStream: React.FC<CameraStreamProps> = ({ canvasRef, cameraReady, videoWidth, videoHeight }) => {
  useEffect(() => {
    if (canvasRef.current && cameraReady) {
      const dpr = window.devicePixelRatio || 1;
      const canvasElement = canvasRef.current;
      // Set the intrinsic dimensions to the video size multiplied by the device pixel ratio.
      canvasElement.width = videoWidth * dpr;
      canvasElement.height = videoHeight * dpr;
      // Set the CSS display size to the actual video dimensions.
      canvasElement.style.width = `${videoWidth}px`;
      canvasElement.style.height = `${videoHeight}px`;
      const ctx = canvasElement.getContext('2d');
      if (ctx) {
        // Scale all drawing operations so they work with the intrinsic dimensions.
        ctx.scale(dpr, dpr);
      }
    }
  }, [canvasRef, cameraReady, videoWidth, videoHeight]);

  return (
    <Box position="relative">
      <canvas
        ref={canvasRef}
        style={{ width: `${videoWidth}px`, height: `${videoHeight}px`, display: 'block' }}
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
