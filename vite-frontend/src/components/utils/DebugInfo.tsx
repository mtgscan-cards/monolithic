// src/components/DebugInfo.tsx
import React from 'react';
import { Box, Divider, Card, CardContent, CardMedia, Typography } from '@mui/material';
import { InferenceResult } from '../../scanner/backendService';

interface DebugInfoProps {
  roiSnapshot: string | null;
  inferenceResult: InferenceResult | null;
}

const DebugInfo: React.FC<DebugInfoProps> = ({ roiSnapshot, inferenceResult }) => {
  return (
    <Box mt={4} sx={{ display: 'none' }}>
      <Divider sx={{ mb: 2 }} />
      {roiSnapshot && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              ROI Snapshot (Debug)
            </Typography>
            <CardMedia component="img" image={roiSnapshot} alt="ROI Snapshot" />
          </CardContent>
        </Card>
      )}
      {inferenceResult && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Backend Inference Result (Debug)
            </Typography>
            <pre>{JSON.stringify(inferenceResult, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default DebugInfo;
