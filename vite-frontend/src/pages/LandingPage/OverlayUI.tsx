// src/pages/LandingPage/OverlayUI.tsx

import React from 'react'
import { Box, Typography, Stack, Button } from '@mui/material'

const OverlayUI = () => (
  <Box
    sx={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      minHeight: '800px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      textAlign: 'center',
      px: 2,
      zIndex: 1,
    }}
  >
    <Box sx={{ maxWidth: 800, textAlign: 'center' }}>
      <Typography variant="h2" gutterBottom sx={{ fontWeight: 600 }}>
        Your Magic Cards. Instantly Recognized.
      </Typography>
      <Typography variant="h5" sx={{ mb: 4 }}>
        Snap a picture. See your card. Add it to your collection in seconds.
      </Typography>
      <Stack spacing={2} direction="row" justifyContent="center">
        <Button variant="contained" color="primary" href="/scan">
          Start Scanning
        </Button>
        <Button variant="outlined" color="secondary" href="/search">
          Try Demo
        </Button>
      </Stack>
    </Box>
  </Box>
)

export default OverlayUI
