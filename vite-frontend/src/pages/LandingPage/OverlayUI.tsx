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
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      textAlign: 'center',
      px: 2,
    }}
  >
    <Typography variant="h2" gutterBottom sx={{ fontWeight: 600 }}>
      Your Magic Cards. Instantly Recognized.
    </Typography>
    <Typography variant="h5" sx={{ maxWidth: 600, mb: 4 }}>
      Snap a picture. See your card. Add it to your collection in seconds.
    </Typography>
    <Stack spacing={2} direction="row" sx={{ pointerEvents: 'auto' }}>
      <Button variant="contained" color="primary" href="/scan">
        Start Scanning
      </Button>
      <Button variant="outlined" color="secondary" href="/search">
        Try Demo
      </Button>
    </Stack>
  </Box>
)

export default OverlayUI
