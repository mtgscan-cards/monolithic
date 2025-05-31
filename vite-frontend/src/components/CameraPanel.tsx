import React from 'react';
import { Box, Card, Typography } from '@mui/material';
import CameraStream from './CameraStream';

interface CameraPanelProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  videoWidth: number;
  videoHeight: number;
  cameraReady: boolean;
  status: string | React.ReactNode;
  quad?: { x: number; y: number }[] | null;
}

const CameraPanel: React.FC<CameraPanelProps> = ({
  videoRef,
  canvasRef,
  videoWidth,
  videoHeight,
  cameraReady,
  status,
  quad,
}) => {
  return (
    <Card elevation={3} sx={{ position: 'relative', width: '100%', height: 'auto' }}>
      <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
        <CameraStream
          canvasRef={canvasRef}
          videoRef={videoRef}
          videoWidth={videoWidth}
          videoHeight={videoHeight}
          cameraReady={cameraReady}
          quad={quad}
        />
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
      </Box>
    </Card>
  );
};

export default CameraPanel;
