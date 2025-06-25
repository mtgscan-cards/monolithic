// src/pages/Legal/LegalPage.tsx

import React from 'react'
import {
  Container,
  Typography,
  Divider,
  Link,
  List,
  ListItem,
  ListItemText,
  Box,
} from '@mui/material'

const LegalPage: React.FC = () => {
  return (
    <Container
      maxWidth="md"
      sx={{
        py: 8,
        fontSize: '1rem', // base font size for uniformity
        '@media print': {
          py: 0,
          backgroundColor: '#fff',
          color: '#000',
        },
      }}
    >
      {/* Terms of Service */}
      <Box component="section" sx={{ mb: 8, breakInside: 'avoid' }}>
        <Typography variant="h4" gutterBottom>
          Terms of Service
        </Typography>

        <Typography sx={{ lineHeight: 1.8, mb: 3 }}>
          By accessing or using <strong>MTGScan.cards</strong>, you agree to the following terms and conditions.
          These terms are intended to protect both our users and the integrity of the service.
        </Typography>

        <List sx={{ listStyleType: 'disc', pl: 3 }}>
          {[
            'You are solely responsible for any activity or content associated with your account.',
            'MTGScan.cards makes no guarantees regarding site uptime, availability, or the accuracy of data, including but not limited to card metadata and pricing.',
            'This service is provided “as is” without warranties of any kind, express or implied.',
            'We reserve the right to update, modify, or discontinue the service at any time without notice.',
            'By continuing to use this site, you acknowledge and accept these terms in full.',
          ].map((text, idx) => (
            <ListItem key={idx} disableGutters sx={{ display: 'list-item' }}>
              <ListItemText primary={text} />
            </ListItem>
          ))}
        </List>
      </Box>

      <Divider sx={{ my: 6 }} />

      {/* Open Source License */}
      <Box component="section" sx={{ mb: 8, breakInside: 'avoid' }}>
        <Typography variant="h4" gutterBottom>
          Open Source License
        </Typography>

        <Typography sx={{ lineHeight: 1.8 }}>
          <strong>MTGScan.cards</strong> is licensed under the{' '}
          <Link
            href="https://www.gnu.org/licenses/gpl-3.0.en.html"
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
          >
            GNU General Public License v3.0
          </Link>
          .
        </Typography>

        <Typography sx={{ lineHeight: 1.8, mt: 2 }}>
          This means you are free to use, modify, and redistribute the software under the terms of the GPL.
          Any derivative work must also be open source and licensed under the GPL.
        </Typography>
      </Box>

      <Divider sx={{ my: 6 }} />

      {/* Disclaimers */}
      <Box component="section" sx={{ mb: 8, breakInside: 'avoid' }}>
        <Typography variant="h4" gutterBottom>
          Legal Disclaimers
        </Typography>

        <Typography sx={{ lineHeight: 1.8 }}>
          Magic: The Gathering, its logo, card images, and related properties are trademarks of Wizards of the Coast LLC, a subsidiary of Hasbro, Inc. © 1993–2025 Wizards. All rights reserved.
        </Typography>

        <Typography sx={{ lineHeight: 1.8, mt: 2 }}>
          MTGScan.cards is not affiliated with, endorsed, sponsored, or specifically approved by Wizards of the Coast LLC.
          Use of Magic: The Gathering–related intellectual property is permitted under the guidelines of their Fan Content Policy.
        </Typography>

        <Typography sx={{ lineHeight: 1.8, mt: 2 }}>
          Some card data and pricing information is provided by{' '}
          <Link
            href="https://scryfall.com/"
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
          >
            Scryfall
          </Link>
          . Scryfall does not guarantee the accuracy or completeness of its pricing data and recommends verifying with individual retailers.
        </Typography>
      </Box>

      {/* Contact */}
      <Box component="section" sx={{ mt: 6, breakInside: 'avoid' }}>
        <Typography sx={{ lineHeight: 1.6 }}>
          For questions, feedback, or legal inquiries, please leave correspondence at{' '}
          <Link
            href="mailto:jake@serverboi.org"
            underline="hover"
            color="primary"
          >
            jake@serverboi.org
          </Link>
          .
        </Typography>
      </Box>
    </Container>
  )
}

export default LegalPage
