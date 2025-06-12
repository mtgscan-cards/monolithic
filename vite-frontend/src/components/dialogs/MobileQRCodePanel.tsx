import React from 'react';
import {
  Box,
  Typography,
  Tooltip,
  IconButton,
  Paper,
  Fade,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import QRCode from 'react-qr-code';

interface Props {
  sessionId: string;
  waiting: boolean;
  onRefresh: () => void;
  visible?: boolean; // optional visibility toggle
}

const MobileQRCodePanel: React.FC<Props> = ({
  sessionId,
  waiting,
  onRefresh,
  visible = true,
}) => {
  const scanUrl = `${window.location.origin}/mobile-scan/${sessionId}`;

  return (
    <Fade in={visible} timeout={400}>
      <Paper
        elevation={3}
        sx={{
          backgroundColor: '#1c1c1c',
          p: 3,
          borderRadius: 2,
          textAlign: 'center',
        }}
      >
        <Typography variant="subtitle1" mb={2}>
          Open this QR code on your phone to scan a card
        </Typography>

        <Box sx={{ position: 'relative', display: 'inline-block' }}>
          <Box
            sx={{
              background: 'white',
              padding: 2,
              borderRadius: 1,
            }}
          >
            <QRCode value={scanUrl} style={{ height: 180, width: 180 }} />
          </Box>

          <Tooltip title="Refresh QR code session">
            <IconButton
              size="small"
              onClick={onRefresh}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '100%',
                transform: 'translate(8px, -50%)',
                backgroundColor: 'background.paper',
                color: 'primary.main',
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Typography variant="caption" display="block" mt={2}>
          Or visit:<br />{scanUrl}
        </Typography>

        {waiting && (
          <Typography variant="body2" color="text.secondary" mt={1}>
            Now awaiting scans from mobile device...
          </Typography>
        )}
      </Paper>
    </Fade>
  );
};

export default MobileQRCodePanel;