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
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import CameraStream from '../components/CameraStream';
import CardList from '../components/CardList';
import DebugInfo from '../components/DebugInfo';
import LastScannedCard from '../components/LastScannedCard';
import AlternatePrintingsDialog, { Card as AltCard } from '../components/AlternatePrintingsDialog';
import useFrameProcessor from '../hooks/useFrameProcessor';
import { InferenceResult } from '../scanner/backendService';
import type { ScannedCard } from '../hooks/useFrameProcessor';
import { getAlternatePrintings } from '../api/cards';
import './ScanPage.css';

const drawerWidth = 300; // fixed width for the drawer

const ScanPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Use persistent drawer on larger screens and temporary drawer on mobile
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [roiSnapshot, setRoiSnapshot] = useState<string | null>(null);
  const [inferenceResult, setInferenceResult] = useState<InferenceResult | null>(null);
  const [scannedCards, setScannedCards] = useState<ScannedCard[]>([]);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({
    width: 640,
    height: 480,
  });

  // State for Alternate Printings Dialog
  const [alternateDialogOpen, setAlternateDialogOpen] = useState(false);
  const [altPrintings, setAltPrintings] = useState<AltCard[]>([]);

  // Update drawer state when viewport size changes
  useEffect(() => {
    setDrawerOpen(!isMobile);
  }, [isMobile]);

  // Determine the last scanned card
  const lastCard = scannedCards.length > 0 ? scannedCards[scannedCards.length - 1] : null;

  // Initialize webcam stream
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

  // Start frame processing
  useFrameProcessor({
    videoRef,
    canvasRef,
    setStatus,
    setInferenceResult,
    setRoiSnapshot,
    setScannedCards,
  });

  // Toggle foil pricing for a scanned card
  const handleToggleFoil = (cardId: string) => {
    setScannedCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, foil: !card.foil } : card))
    );
  };

  // Remove a card from the collection
  const handleRemoveCard = (cardId: string) => {
    setScannedCards((prev) => prev.filter((card) => card.id !== cardId));
  };

  // Toggle the drawer open/close
  const handleDrawerToggle = () => {
    setDrawerOpen((prev) => !prev);
  };

  // Open the alternate printings dialog via API fetch
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

  // Switch the last scanned card to the selected alternate printing
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

  // Remove an alternate printing from the list
  const handleRemoveAlternate = (altCard: AltCard) => {
    setAltPrintings((prev) => prev.filter((a) => a.id !== altCard.id));
  };

  return (
    <Container maxWidth="lg" sx={{ paddingY: 4 }}>
      {/* Fixed position toggle button - always anchored to the viewport top-right */}
      <Box
        sx={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <IconButton onClick={handleDrawerToggle} color="primary">
          {drawerOpen ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>

      <Typography variant="h4" component="h1" textAlign="center" mb={2}>
        Card Scanner for MTG
      </Typography>

      <Box className="scan-page-container">
        {/* Main Content Area */}
        <Box className="scan-page-main">
          <Card elevation={3} className="camera-card">
            <Box className="camera-wrapper">
              <CameraStream
                canvasRef={canvasRef}
                cameraReady={cameraReady}
                videoWidth={videoDimensions.width}
                videoHeight={videoDimensions.height}
              />
              {/* Hidden video element used for processing */}
              <video ref={videoRef} style={{ display: 'none' }} />
              <Box className="status-overlay">
                <Typography variant="body2">{status}</Typography>
              </Box>
            </Box>
          </Card>

          {/* Last Scanned Card with Alternate Printings Button */}
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

          {/* Debug Information */}
          <Box className="debug-section">
            <DebugInfo roiSnapshot={roiSnapshot} inferenceResult={inferenceResult} />
          </Box>
        </Box>

        {/* Drawer for Card List */}
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

      {/* Alternate Printings Dialog */}
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
