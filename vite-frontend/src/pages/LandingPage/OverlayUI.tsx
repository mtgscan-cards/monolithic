// src/pages/LandingPage/OverlayUI.tsx

import { Box, Typography, Stack, Button } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

const OverlayUI = () => (
  <Box
    component="section"
    role="region"
    aria-label="Landing overlay"
    sx={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      textAlign: 'center',
      px: 2,
      zIndex: 1,
      pointerEvents: 'auto',
    }}
  >
    <Box sx={{ maxWidth: 800, textAlign: 'center' }}>
      <Typography
        variant="h1"
        component="h1"
        gutterBottom
        sx={{ fontWeight: 600, fontSize: { xs: '2rem', md: '3rem' } }}
      >
        Your Magic Cards. Instantly Recognized.
      </Typography>
      <Typography
        variant="h5"
        component="p"
        sx={{ mb: 4, fontSize: { xs: '1.2rem', md: '1.5rem' } }}
      >
        Snap a picture. See your card. Add it to your collection in seconds.
      </Typography>
      <Stack spacing={2} direction="row" justifyContent="center">
        <Button
          variant="contained"
          color="primary"
          component={RouterLink}
          to="/login?next=/scan"
          aria-label="Start scanning your Magic cards"
          sx={{ textTransform: 'none' }}
        >
          Start Scanning
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          component={RouterLink}
          to="/collections"
          aria-label="Create or view your collection"
          sx={{ textTransform: 'none' }}
        >
          Create your collection
        </Button>
      </Stack>
    </Box>
  </Box>
)

export default OverlayUI
