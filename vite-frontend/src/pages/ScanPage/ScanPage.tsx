import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Drawer,
  IconButton,
  useMediaQuery,
  useTheme,
  Stack
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';


import CardList from '../../components/cards/CardList';
import DebugInfo from '../../components/utils/DebugInfo';
import LastScannedCard from '../../components/camera/LastScannedCard';
import AlternatePrintingsDialog, { Card as AltCard } from '../../components/dialogs/AlternatePrintingsDialog';
import useFrameProcessor from '../../hooks/useFrameProcessor';
import { InferenceResult } from '../../scanner/backendService';
import type { ScannedCard } from '../../hooks/useFrameProcessor';
import { getAlternatePrintings } from '../../api/cards';
import MobileScanToggleButton from '../../components/dialogs/MobileScanToggleButton';
import '../../styles/ScanPage.css';
import MobileQRCodePanel from '../../components/dialogs/MobileQRCodePanel';
import CameraPanel from '../../components/camera/CameraPanel';

const drawerWidth = 300;

const ScanPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const videoRef = useRef<HTMLVideoElement>(null) as React.RefObject<HTMLVideoElement>;
  const canvasRef = useRef<HTMLCanvasElement>(null) as React.RefObject<HTMLCanvasElement>;

  const [cameraReady, setCameraReady] = useState(false);
  const [status, setStatus] = useState<React.ReactNode>('Initializing...');
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

  async function initCameraWithRetry(retries = 3, delay = 500) {
    for (let i = 0; i < retries; i++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (didAbort) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStream = stream;
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
              setStatus(
                <>
                  Error playing video stream.{' '}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.reload();
                    }}
                    style={{ textDecoration: 'underline', color: 'inherit' }}
                  >
                    Refresh?
                  </a>
                </>
              );
            }
          };
        }
        return;
      } catch (err) {
        console.warn(`Camera allocation failed (attempt ${i + 1}):`, err);
        if (i === retries - 1) {
          setStatus(
            <>
              Failed to access webcam. Another app or tab may be using it.{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.reload();
                }}
                style={{ textDecoration: 'underline', color: 'inherit' }}
              >
                Try Again?
              </a>
            </>
          );
        } else {
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
  }

  initCameraWithRetry();

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

const [showOverlayMarker, setShowOverlayMarker] = useState(false);

// ✅ Then safely use it inside the processor hook
const {
  manualSnapshotFromOverlay
} = useFrameProcessor({
  videoRef,
  canvasRef,
  setStatus,
  setInferenceResult,
  setRoiSnapshot,
  onScannedCard: (card: ScannedCard) => {
    setScannedCards((prev) => {
      const existingIndex = prev.findIndex((c) => c.id === card.id);
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1,
        };
        return updated;
      } else {
        return [...prev, { ...card, quantity: 1 }];
      }
    });

    setShowOverlayMarker(true);
    setTimeout(() => setShowOverlayMarker(false), 2000);
  },
});


  const handleToggleFoil = (cardId: string) => {
    setScannedCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, foil: !card.foil } : card))
    );
  };

  const handleRemoveCard = (cardId: string) => {
    setScannedCards((prev) => {
      const index = [...prev].reverse().findIndex((card) => card.id === cardId);
      if (index === -1) return prev;

      const removeIndex = prev.length - 1 - index;
      const card = prev[removeIndex];

      if (card.quantity > 1) {
        const updated = [...prev];
        updated[removeIndex] = {
          ...updated[removeIndex],
          quantity: updated[removeIndex].quantity - 1,
        };
        return updated;
      } else {
        return prev.filter((_, i) => i !== removeIndex);
      }
    });
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



  const processedResultIds = useRef(new Set<string>());

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

        if (data?.result && data.result_id && !processedResultIds.current.has(data.result_id)) {
          processedResultIds.current.add(data.result_id);
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
    <Box
  sx={{
    width: '100%',
    maxWidth: 'lg',
    marginX: 'auto',
    paddingY: 4,
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
  }}
>
<Box sx={{ position: 'fixed', top: 80, right: 16, zIndex: theme.zIndex.drawer + 1 }}>
  <IconButton onClick={handleDrawerToggle} color="primary">
    {drawerOpen ? <ChevronRightIcon /> : <ChevronLeftIcon />}
  </IconButton>
</Box>

      <Box textAlign="center" mb={{ xs: 2, md: 4 }} px={{ xs: 1, sm: 2 }}>
        <Typography
          variant="h6"
          fontWeight={600}
          sx={{
            fontSize: {
              xs: '1rem',  // phones
              sm: '1.5rem',  // small tablets
              md: '2rem',    // desktops
            },
          }}
        >
          MTG Scanner
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, fontSize: { xs: '0.85rem', sm: '1rem' } }}
        >
          Scan cards using a phone or webcam
        </Typography>
      </Box>

      <Box
        sx={{
          width: '100%',
          borderBottom: '2px solid',
          borderColor: 'divider',
          my: { xs: 2, md: 3 },
          borderRadius: 1,
          opacity: 0.7,
        }}
      />

      <Stack spacing={2} alignItems="center" my={3}>
        <MobileScanToggleButton isOpen={mobileDropdownOpen} onClick={handleToggleMobileDropdown} />

        {mobileDropdownOpen && mobileSessionId && (
          <MobileQRCodePanel
            sessionId={mobileSessionId}
            waiting={mobileWaiting}
            onRefresh={handleManualRefresh}
          />
        )}
      </Stack>

      <Box className="scan-page-container">
        <Box className="scan-page-main">
<CameraPanel
  canvasRef={canvasRef}
  videoRef={videoRef}
  videoWidth={videoDimensions.width}
  videoHeight={videoDimensions.height}
  cameraReady={cameraReady}
  status={status}
  onTapSnapshot={manualSnapshotFromOverlay}
  showOverlayMarker={showOverlayMarker}
/>

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
      marginTop: '64px',
    },
  }}
>
  <Box
    className="scan-page-drawer"
    p={2}
    sx={{
      marginTop: '0px', // 👈 Add the margin here
    }}
  >
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
    </Box>
  );
};

export default ScanPage;