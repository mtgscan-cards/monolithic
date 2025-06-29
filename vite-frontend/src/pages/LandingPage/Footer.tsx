// vite-frontend/src/components/layout/Footer.tsx

import React from 'react'
import {
  Box,
  Typography,
  Grid,
  Link,
  Stack,
  Container
} from '@mui/material'
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined'
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined'
import LatestCommitLink from './LatestCommitLink'
import styles from './Footer.module.css'

const Footer: React.FC = () => {
  return (
    <Box component="footer" className={styles.footerWrapper}>
      <Container maxWidth="lg">
        <Grid container spacing={4} justifyContent="center">
          <Grid item xs={12} sm={6} md={4}>
            <Stack direction="row" alignItems="center" spacing={1} className={styles.sectionHeader}>
              <CameraAltOutlinedIcon fontSize="small" className={styles.icon} />
              <Typography variant="h6" className={styles.title}>
                MTGScan.cards
              </Typography>
            </Stack>
            <Typography className={styles.description}>
              Instantly scan and track your Magic: The Gathering cards with open source computer vision.
            </Typography>
            <Typography variant="caption" className={styles.license}>
              <LatestCommitLink /> • GPL 3.0
            </Typography>
          </Grid>

          <Grid item xs={6} sm={4} md={2}>
            <Stack spacing={0.5} alignItems="flex-start">
              <Typography variant="subtitle2" className={styles.heading}>
                <MenuBookOutlinedIcon fontSize="small" className={styles.icon} />
                Resources
              </Typography>
              <Link href="https://deepwiki.com/mtgscan-cards/monolithic" className={styles.link}>
                Docs
              </Link>
              <Link href="https://api.mtgscan.cards/apidocs" className={styles.link}>
                API Docs
              </Link>
            </Stack>
          </Grid>

          <Grid item xs={6} sm={4} md={2}>
            <Stack spacing={0.5} alignItems="flex-start">
              <Typography variant="subtitle2" className={styles.heading}>
                <PublicOutlinedIcon fontSize="small" className={styles.icon} />
                Community
              </Typography>
              <Link href="https://github.com/mtgscan-cards" className={styles.link}>
                GitHub
              </Link>
              <Link href="https://github.com/mtgscan-cards/monolithic/commits/main/" className={styles.link}>
                Changelog
              </Link>
              <Link href="https://github.com/mtgscan-cards/monolithic/issues" className={styles.link}>
                Issue Tracker
              </Link>
            </Stack>
          </Grid>

          <Grid item xs={6} sm={4} md={2}>
            <Stack spacing={0.5} alignItems="flex-start">
              <Typography variant="subtitle2" className={styles.heading}>
                <GavelOutlinedIcon fontSize="small" className={styles.icon} />
                Legal
              </Typography>
              <Link href="/legal" className={styles.link}>
                Terms of Service
              </Link>
              <Link href="https://raw.githubusercontent.com/mtgscan-cards/monolithic/main/LICENSE" className={styles.link}>
                License
              </Link>
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
            loading="lazy"
            className={styles.heartIcon}
          />
          by players, collectors, and developers.
        </Typography>
      </Box>
    </Box>
  )
}

export default Footer
