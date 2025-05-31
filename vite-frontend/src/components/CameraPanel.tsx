// CameraPanel.tsx
import React from 'react';
import { Box, Card, Typography } from '@mui/material';
import CameraStream from './CameraStream';

interface CameraPanelProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  videoWidth: number;
  videoHeight: number;
  cameraReady: boolean;
  status: React.ReactNode;
  onTapSnapshot?: () => void;
  showOverlayMarker?: boolean;
  quad?: [number, number][];
}

const CameraPanel: React.FC<CameraPanelProps> = ({
  videoRef,
  canvasRef,
  videoWidth,
  videoHeight,
  cameraReady,
  status,
  onTapSnapshot,
  showOverlayMarker,
  quad,
}) => {
  const handleTap = () => {
    console.log('[CameraPanel] Overlay tap detected');
    onTapSnapshot?.();
  };

  return (
    <Card elevation={3} sx={{ position: 'relative', width: '100%', height: 'auto' }}>
      <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
        <Box
          onClick={handleTap}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 5,
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
        />

        <CameraStream
          canvasRef={canvasRef}
          videoRef={videoRef}
          videoWidth={videoWidth}
          videoHeight={videoHeight}
          cameraReady={cameraReady}
          quad={quad ? quad.map(([x, y]) => ({ x, y })) : undefined}
          showOverlayMarker={showOverlayMarker}
          onTapSnapshot={() => {
            console.log('[CameraStream] onTapSnapshot triggered');
            onTapSnapshot?.();
          }}
        />

        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            zIndex: 10,
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
