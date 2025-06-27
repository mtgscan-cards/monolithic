import React from 'react'
import {
  Box,
  Typography,
  Grid,
  Link,
  Stack,
  Container,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import LatestCommitLink from './LatestCommitLink'
import styles from './Footer.module.css'

const Footer: React.FC = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  return (
    <Box component="footer" className={styles.footerWrapper}>
      <Container maxWidth="lg">
        <Grid container spacing={4} justifyContent="center">
          <Grid item xs={12} sm={6} md={4}>
            <Stack
              direction={isMobile ? 'column' : 'row'}
              alignItems={isMobile ? 'flex-start' : 'center'}
              spacing={1}
              className={styles.sectionHeader}
            >
              <CameraAltOutlinedIcon fontSize="small" className={styles.icon} />
              <Typography variant="h6" className={styles.title}>
                MTGScan.cards
              </Typography>
            </Stack>
            <Typography className={styles.description}>
              Scan and track your MTG cards with Open Source computer vision.
            </Typography>
            <Typography variant="caption" className={styles.license}>
              <LatestCommitLink />
              {' • GPL 3.0'}
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="subtitle2" className={styles.heading}>
              <MenuBookOutlinedIcon fontSize="small" className={styles.icon} />
              Resources
            </Typography>
            <Stack spacing={0.75}>
              <Link href="https://deepwiki.com/mtgscan-cards/monolithic" className={styles.link}>Docs</Link>
              <Link href="https://api.mtgscan.cards/apidocs" className={styles.link}>API Docs</Link>
            </Stack>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="subtitle2" className={styles.heading}>
              <PublicOutlinedIcon fontSize="small" className={styles.icon} />
              Community
            </Typography>
            <Stack spacing={0.75}>
              <Link href="https://github.com/mtgscan-cards" className={styles.link}>GitHub</Link>
              <Link href="https://github.com/mtgscan-cards/monolithic/commits/main/" className={styles.link}>Changelog</Link>
            </Stack>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Typography variant="subtitle2" className={styles.heading}>
              <GavelOutlinedIcon fontSize="small" className={styles.icon} />
              Legal
            </Typography>
            <Stack spacing={0.75}>
              <Link href="/legal" className={styles.link}>Terms of Service</Link>
              <Link href="https://raw.githubusercontent.com/mtgscan-cards/monolithic/refs/heads/main/LICENSE" className={styles.link}>License</Link>
            </Stack>
          </Grid>
        </Grid>
      </Container>

      <Box className={styles.footerBottom}>
        <Typography variant="body2" className={styles.footerCredit}>
          Made with
          <img
            src="/img/512.webp"
            alt="Heart"
            width={18}
            height={18}
            className={styles.heartIcon}
          />
          by players, collectors, and developers.
        </Typography>
      </Box>
    </Box>
  )
}

export default Footer
