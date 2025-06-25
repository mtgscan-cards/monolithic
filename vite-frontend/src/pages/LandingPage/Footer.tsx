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
        pt: 3,
        pb: 2,
        borderTop: '1px solid rgba(255, 255, 255, 0.2)',
        fontSize: '0.9rem',
      }}
    >
      <Container maxWidth="lg" sx={{ display: 'flex', justifyContent: 'center' }}>
        <Grid container spacing={3} justifyContent="center" alignItems="flex-start">
          <Grid item xs={12} sm={6} md={4}>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <CameraAltOutlinedIcon fontSize="small" sx={{ color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#fff', fontSize: '1rem' }}>
                MTGScan.cards
              </Typography>
            </Stack>
            <Typography sx={{ color: '#999', lineHeight: 1.5 }}>
              Scan and track your MTG cards with Open Source computer vision.
            </Typography>
            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 1.2, color: '#555', minHeight: 20 }}
            >
              <LatestCommitLink />
              {' • GPL 3.0'}
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', mb: 1, color: '#fff' }}>
              <MenuBookOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
              Resources
            </Typography>
            <Stack spacing={0.75}>
              <Link href="https://deepwiki.com/mtgscan-cards/monolithic" underline="none" color="#aaa">Docs</Link>
              <Link href="https://api.mtgscan.cards/apidocs" underline="none" color="#aaa">API Docs</Link>
            </Stack>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', mb: 1, color: '#fff' }}>
              <PublicOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
              Community
            </Typography>
            <Stack spacing={0.75}>
              <Link href="https://github.com/mtgscan-cards" underline="none" color="#aaa">GitHub</Link>
              <Link href="https://github.com/mtgscan-cards/monolithic/commits/main/" underline="none" color="#aaa">Changelog</Link>
            </Stack>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', mb: 1, color: '#fff' }}>
              <GavelOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
              Legal
            </Typography>
            <Stack spacing={0.75}>
              <Link href="/legal" underline="none" color="#aaa">Terms of Service</Link>
              <Link href="https://raw.githubusercontent.com/mtgscan-cards/monolithic/refs/heads/main/LICENSE" underline="none" color="#aaa">License</Link>
            </Stack>
          </Grid>
        </Grid>
      </Container>

      <Box
        sx={{
          mt: 3,
          pt: 1,
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          textAlign: 'center',
          color: '#555',
          fontSize: '0.8rem',
        }}
      >
        <Typography
          variant="body2"
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}
        >
          Made with
          <img
            src="https://fonts.gstatic.com/s/e/notoemoji/latest/2764/512.webp"
            alt="Heart"
            width={18}
            height={18}
            style={{
              verticalAlign: 'middle',
              display: 'inline-block',
              aspectRatio: '1 / 1',
            }}
          />
          by players, collectors, and developers.
        </Typography>
      </Box>
    </Box>
  )
}

export default Footer