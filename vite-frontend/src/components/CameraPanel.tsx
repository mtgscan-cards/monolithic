// src/components/CameraPanel.tsx
import React from 'react';
import { Box, Card, Typography } from '@mui/material';
import CameraStream from './CameraStream';

// Shared constants for ROI and overlay dimensions
export const OVERLAY_WIDTH_RATIO = 0.42;
export const OVERLAY_HEIGHT_RATIO = 0.84;

interface CameraPanelProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  videoWidth: number;
  videoHeight: number;
  cameraReady: boolean;
  status: React.ReactNode;
  onTapSnapshot?: (roiSnapshot: string) => void;
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
  return (
    <Card elevation={3} sx={{ position: 'relative', width: '100%', height: 'auto' }}>
      <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
        <CameraStream
          canvasRef={canvasRef}
          videoRef={videoRef}
          videoWidth={videoWidth}
          videoHeight={videoHeight}
          cameraReady={cameraReady}
          quad={quad ? quad.map(([x, y]) => ({ x, y })) : undefined}
          showOverlayMarker={showOverlayMarker}
          onTapSnapshot={onTapSnapshot}
          overlayWidthRatio={OVERLAY_WIDTH_RATIO}
          overlayHeightRatio={OVERLAY_HEIGHT_RATIO}
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