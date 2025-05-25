import React, { useState, useRef, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  Drawer,
  IconButton,
  useMediaQuery,
  useTheme,
  Stack,
  Tooltip,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import QRCode from 'react-qr-code';
import RefreshIcon from '@mui/icons-material/Refresh';

import CameraStream from '../components/CameraStream';
import CardList from '../components/CardList';
import DebugInfo from '../components/DebugInfo';
import LastScannedCard from '../components/LastScannedCard';
import AlternatePrintingsDialog, { Card as AltCard } from '../components/AlternatePrintingsDialog';
import useFrameProcessor from '../hooks/useFrameProcessor';
import { InferenceResult } from '../scanner/backendService';
import type { ScannedCard } from '../hooks/useFrameProcessor';
import { getAlternatePrintings } from '../api/cards';
import MobileScanToggleButton from '../components/MobileScanToggleButton';
import './ScanPage.css';

const drawerWidth = 300;

const ScanPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [roiSnapshot, setRoiSnapshot] = useState<string | null>(null);
  const [inferenceResult, setInferenceResult] = useState<InferenceResult | null>(null);
  const [scannedCards, setScannedCards] = useState<ScannedCard[]>([]);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });

  const [alternateDialogOpen, setAlternateDialogOpen] = useState(false);
  const [altPrintings, setAltPrintings] = useState<AltCard[]>([]);

  const [mobileSessionId, setMobileSessionId] = useState<string | null>(null);
  const [mobileWaiting, setMobileWaiting] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setDrawerOpen(!isMobile);
  }, [isMobile]);

  const lastCard = scannedCards.length > 0 ? scannedCards[scannedCards.length - 1] : null;

  useEffect(() => {
    let didAbort = false;
    let localStream: MediaStream | null = null;
    const videoElement = videoRef.current;

    async function initCamera() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (didAbort) {
          localStream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoElement) {
          videoElement.srcObject = localStream;
          videoElement.onloadedmetadata = async () => {
            const { videoWidth, videoHeight } = videoElement;
            setVideoDimensions({ width: videoWidth, height: videoHeight });
            try {
              await videoElement.play();
              setCameraReady(true);
              setStatus('Webcam starting...');
            } catch {
              setStatus('Error playing video stream');
            }
          };
        }
      } catch (err) {
        console.error('Error accessing webcam:', err);
        setStatus('Error accessing webcam');
      }
    }

    initCamera();

    return () => {
      didAbort = true;
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, []);

  useFrameProcessor({
    videoRef,
    canvasRef,
    setStatus,
    setInferenceResult,
    setRoiSnapshot,
    setScannedCards,
  });

  const handleToggleFoil = (cardId: string) => {
    setScannedCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, foil: !card.foil } : card))
    );
  };

  const handleRemoveCard = (cardId: string) => {
    setScannedCards((prev) => prev.filter((card) => card.id !== cardId));
  };

  const handleDrawerToggle = () => {
    setDrawerOpen((prev) => !prev);
  };

  const handleOpenAlternateDialog = async () => {
    if (!lastCard) return;
    try {
      const alternate = await getAlternatePrintings(lastCard.id);
      setAltPrintings(alternate);
    } catch (error) {
      console.error('Error fetching alternate printings', error);
    } finally {
      setAlternateDialogOpen(true);
    }
  };

  const handleSwitchAlternate = (altCard: AltCard) => {
    setScannedCards((prev) => {
      const newCards = [...prev];
      if (newCards.length > 0) {
        const lastIndex = newCards.length - 1;
        newCards[lastIndex] = {
          ...newCards[lastIndex],
          imageUri: Array.isArray(altCard.image_uris)
            ? altCard.image_uris[0]?.png || newCards[lastIndex].imageUri
            : altCard.image_uris?.png || newCards[lastIndex].imageUri,
          set: altCard.set || newCards[lastIndex].set,
          setName: altCard.set_name || newCards[lastIndex].setName,
        };
      }
      return newCards;
    });
    setAlternateDialogOpen(false);
  };

  const handleRemoveAlternate = (altCard: AltCard) => {
    setAltPrintings((prev) => prev.filter((a) => a.id !== altCard.id));
  };

  const handleToggleMobileDropdown = async () => {
    const toggled = !mobileDropdownOpen;
    setMobileDropdownOpen(toggled);

    if (toggled && !mobileSessionId) {
      await createMobileSession();
    }
  };

  const createMobileSession = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/mobile-infer/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        credentials: 'include',
      });
      const data = await res.json();
      setMobileSessionId(data.session_id);
      setMobileWaiting(true);
      setStatus("Waiting for scan from mobile...");
      console.log("New session created:", data.session_id);
    } catch (err) {
      console.error("Failed to create mobile session", err);
      setStatus("Failed to start mobile scan");
    }
  };

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await createMobileSession();
    setIsRefreshing(false);
  };

  const lastResultIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mobileSessionId || !mobileWaiting) return;

    const interval = setInterval(async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      try {
        const res = await fetch(`${apiUrl}/api/mobile-infer/result/${mobileSessionId}`, {
          credentials: 'include',
        });

        if (res.status === 403) {
          console.warn("Session expired, regenerating...");
          await createMobileSession();
          return;
        }

        const data = await res.json();

        if (data?.result && data.result_id && data.result_id !== lastResultIdRef.current) {
          lastResultIdRef.current = data.result_id;
          const cardId = data.result.predicted_card_id;

          setScannedCards((prev) => {
            const existingIndex = prev.findIndex((card) => card.id === cardId);
            if (existingIndex !== -1) {
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                quantity: updated[existingIndex].quantity + 1,
              };
              return updated;
            } else {
              return [
                ...prev,
                {
                  id: cardId,
                  name: data.result.predicted_card_name,
                  finishes: data.result.finishes,
                  set: data.result.set,
                  setName: data.result.set_name,
                  prices: {
                    normal: data.result.prices.usd,
                    foil: data.result.prices.usd_foil,
                  },
                  imageUri: data.result.image_uris?.normal,
                  foil: false,
                  quantity: 1,
                  hasFoil:
                    data.result.finishes.includes('foil') &&
                    data.result.prices.usd_foil != null,
                  cardId: cardId,
                  collectorNumber: data.result.collector_number?.replace(/^0+/, '') || '',
                },
              ];
            }
          });

          setStatus(`Scan received: ${data.result.predicted_card_name}`);
        }
      } catch (err) {
        console.error('Error polling mobile scan result:', err);
        setStatus('Error polling scan result');
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [mobileSessionId, mobileWaiting]);

  return (
    <Container maxWidth="lg" sx={{ paddingY: 4 }}>
      <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: theme.zIndex.drawer + 1 }}>
        <IconButton onClick={handleDrawerToggle} color="primary">
          {drawerOpen ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>

      <Typography variant="h4" component="h1" textAlign="center" mb={2}>
        Card Scanner for MTG
      </Typography>

      <Stack spacing={2} alignItems="center" my={3}>
        <MobileScanToggleButton isOpen={mobileDropdownOpen} onClick={handleToggleMobileDropdown} />

        {mobileDropdownOpen && mobileSessionId && (
          <Box textAlign="center">
            <Typography variant="subtitle1" mb={1}>
              Open this QR code on your phone to scan a card
            </Typography>
            <Box
              sx={{
                position: 'relative',
                display: 'block',
                width: 'max-content',
                mx: 'auto', // center QR code container
              }}
            >
              {/* QR Code */}
              <Box
                sx={{
                  background: 'white',
                  padding: 2,
                  borderRadius: 1,
                }}
              >
                <QRCode
                  value={`${window.location.origin}/mobile-scan/${mobileSessionId}`}
                  style={{ height: 180, width: 180 }}
                />
              </Box>

              {/* Refresh icon floated to the middle right of QR */}
              <Tooltip title="Refresh QR code session">
                <IconButton
                  size="small"
                  onClick={handleManualRefresh}
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '100%',
                    transform: 'translate(8px, -50%)',
                    backgroundColor: (theme) => theme.palette.background.paper,
                    color: (theme) => theme.palette.primary.main,

                  }}
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="caption" display="block" mt={1}>
              Or visit:<br />{`${window.location.origin}/mobile-scan/${mobileSessionId}`}
            </Typography>

            {mobileWaiting && (
              <Typography variant="body2" color="text.secondary" mt={1}>
                Now awaiting scans from mobile device...
              </Typography>
            )}
          </Box>
        )}
      </Stack>

      <Box className="scan-page-container">
        <Box className="scan-page-main">
          <Card elevation={3} className="camera-card">
            <Box className="camera-wrapper">
              <CameraStream
                canvasRef={canvasRef}
                cameraReady={cameraReady}
                videoWidth={videoDimensions.width}
                videoHeight={videoDimensions.height}
              />
              <video ref={videoRef} style={{ display: 'none' }} />
              <Box className="status-overlay">
                <Typography variant="body2">{status}</Typography>
              </Box>
            </Box>
          </Card>

          {lastCard && (
            <Box className="last-scanned-card-section">
              <Typography variant="h6" gutterBottom>
                Last Scanned Card
              </Typography>
              <LastScannedCard
                card={lastCard}
                onRemove={handleRemoveCard}
                onAlternate={handleOpenAlternateDialog}
              />
            </Box>
          )}

          <Box className="debug-section">
            <DebugInfo roiSnapshot={roiSnapshot} inferenceResult={inferenceResult} />
          </Box>
        </Box>

        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={handleDrawerToggle}
          variant={isMobile ? 'temporary' : 'persistent'}
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
        >
          <Box className="scan-page-drawer" p={2}>
            <Typography variant="h6" gutterBottom>
              Scanned Cards
            </Typography>
            <CardList scannedCards={scannedCards} handleToggleFoil={handleToggleFoil} />
          </Box>
        </Drawer>
      </Box>

      <AlternatePrintingsDialog
        open={alternateDialogOpen}
        onClose={() => setAlternateDialogOpen(false)}
        altPrintings={altPrintings}
        dialogMode="scan"
        handleSwitchAlternate={handleSwitchAlternate}
        handleRemoveAlternate={handleRemoveAlternate}
      />
    </Container>
  );
};

export default ScanPage;
