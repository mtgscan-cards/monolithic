import React from 'react'
import { Box, Typography, Grid, Link, Stack, Container } from '@mui/material'
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import LatestCommitLink from './LatestCommitLink'

const Footer: React.FC = () => {
  return (
    <Box
      component="footer"
      sx={{
        width: '100%',
        backgroundColor: '#1e1e1e',
        color: '#ccc',
        pt: 5,
        pb: 3,
        borderTop: '1px solid #2a2a2a',
        fontSize: '0.95rem',
      }}
    >
      <Container maxWidth="lg" sx={{ display: 'flex', justifyContent: 'center' }}>
        <Grid
          container
          spacing={{ xs: 4, sm: 5 }}
          justifyContent="center"
          alignItems="flex-start"
        >
          {/* Branding */}
          <Grid item xs={12} sm={6} md={4}>
            <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
              <CameraAltOutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#fff' }}>
                MTGScan.cards
              </Typography>
            </Stack>
            <Typography sx={{ color: '#999', lineHeight: 1.6 }}>
              Scan and track your Magic: The Gathering collection with lightning-fast recognition powered by modern AI.
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: '#555' }}>
              <LatestCommitLink />
              {' • GPL 3.0'}
            </Typography>
          </Grid>

          {/* Resources */}
          <Grid item xs={12} sm={6} md={2}>
            <Typography
              variant="subtitle1"
              sx={{ display: 'flex', alignItems: 'center', mb: 1.2, color: '#fff' }}
            >
              <MenuBookOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
              Resources
            </Typography>
            <Stack spacing={1}>
              <Link href="#" underline="none" color="#aaa">Docs</Link>
              <Link href="#" underline="none" color="#aaa">API</Link>
              <Link href="#" underline="none" color="#aaa">Changelog</Link>
              <Link href="#" underline="none" color="#aaa">Support</Link>
            </Stack>
          </Grid>

          {/* Community */}
          <Grid item xs={12} sm={6} md={2}>
            <Typography
              variant="subtitle1"
              sx={{ display: 'flex', alignItems: 'center', mb: 1.2, color: '#fff' }}
            >
              <PublicOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
              Community
            </Typography>
            <Stack spacing={1}>
              <Link href="#" underline="none" color="#aaa">GitHub</Link>
              <Link href="#" underline="none" color="#aaa">Discord</Link>
              <Link href="#" underline="none" color="#aaa">Reddit</Link>
              <Link href="#" underline="none" color="#aaa">Twitter/X</Link>
            </Stack>
          </Grid>

          {/* Legal */}
          <Grid item xs={12} sm={6} md={2}>
            <Typography
              variant="subtitle1"
              sx={{ display: 'flex', alignItems: 'center', mb: 1.2, color: '#fff' }}
            >
              <GavelOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
              Legal
            </Typography>
            <Stack spacing={1}>
              <Link href="#" underline="none" color="#aaa">Privacy Policy</Link>
              <Link href="#" underline="none" color="#aaa">Terms of Service</Link>
              <Link href="#" underline="none" color="#aaa">License</Link>
            </Stack>
          </Grid>
        </Grid>
      </Container>

      <Box
        sx={{
          mt: 4,
          pt: 2,
          borderTop: '1px solid #2a2a2a',
          textAlign: 'center',
          color: '#555',
          fontSize: '0.85rem',
        }}
      >
        <Typography
          variant="body2"
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}
        >
          Made with
          <img
            src="https://fonts.gstatic.com/s/e/notoemoji/latest/2764/512.webp"
            alt="Heart"
            width={20}
            height={21}
            style={{ verticalAlign: 'middle' }}
          />
          by players and collectors.
        </Typography>
      </Box>
    </Box>
  )
}

export default Footer