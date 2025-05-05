// src/components/SearchResults.tsx
import React, { useState, useEffect, MouseEvent } from 'react';
import {
  Card as MuiCard,
  CardContent,
  Typography,
  Button,
  Grid,
  Box,
  IconButton,
  Fade,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Portal,
  CircularProgress,
  Divider,
} from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { parseManaCost } from './utils/parseManaCost';
import {
  createCollection,
  getCollections,
  addCardToCollection,
  CreateCollectionPayload,
  CollectionData,
} from '../api/collections';
import { getAlternatePrintings } from '../api/cards';
import SetSymbol from './utils/SetSymbol';
import AlternatePrintingsDialog from './AlternatePrintingsDialog';

export interface Card {
  id: string;               // Scryfall UUID
  card_id: number;          // Local DB integer ID ← REQUIRED
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line?: string;
  oracle_text?: string;
  flavor_text?: string;
  colors?: string[] | null;
  color_identity?: string[];
  image_uris?:
    | {
        png?: string;
        large?: string;
        small?: string;
        [key: string]: string | undefined;
      }
    | Array<{
        png?: string;
        large?: string;
        small?: string;
        [key: string]: string | undefined;
      }>
    | null;
  set?: string;
  set_name?: string;
}

export interface SearchResultsProps {
  results: Card[];
  totalResults: number;
  onLoadMore: () => Promise<void>;
  loadingMore: boolean;
}

let lastImageLoadTime = 0;
function scheduleImageLoad(src: string | undefined, setSrc: (src: string | undefined) => void): void {
  const now = Date.now();
  const delay = Math.max(0, 105 - (now - lastImageLoadTime));
  lastImageLoadTime = now + delay;
  setTimeout(() => setSrc(src), delay);
}

interface ToggleableImageProps {
  imageData: Card['image_uris'];
  altText: string;
}

const ToggleableImage: React.FC<ToggleableImageProps> = ({ imageData, altText }) => {
  const [currentFace, setCurrentFace] = useState(0);
  const [fade, setFade] = useState(true);
  const [delayedSrc, setDelayedSrc] = useState<string | undefined>(undefined);

  let targetSrc: string | undefined;
  if (!imageData) {
    targetSrc = undefined;
  } else if (Array.isArray(imageData)) {
    targetSrc = imageData.length === 2 ? imageData[currentFace]?.png : imageData[0]?.png;
  } else {
    targetSrc = imageData.png;
  }

  useEffect(() => {
    scheduleImageLoad(targetSrc, setDelayedSrc);
  }, [targetSrc]);

  const handleToggle = () => {
    setFade(false);
    setTimeout(() => {
      setCurrentFace(prev => (prev === 0 ? 1 : 0));
      setFade(true);
    }, 300);
  };

  if (!imageData) {
    return (
      <Box
        sx={{
          width: '100%',
          height: 200,
          backgroundColor: 'grey.800',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 1,
          mb: 2,
        }}
      >
        <Typography variant="subtitle1" color="text.secondary">
          No Image
        </Typography>
      </Box>
    );
  }

  if (Array.isArray(imageData) && imageData.length === 2) {
    return (
      <Box sx={{ position: 'relative', mb: 2 }}>
        <Fade in={fade} timeout={300}>
          <Box
            component="img"
            src={delayedSrc}
            alt={`${altText} (${currentFace === 0 ? 'Front' : 'Back'} face)`}
            loading="lazy"
            sx={{ width: '100%', height: 'auto', borderRadius: 1 }}
          />
        </Fade>
        <IconButton
          onClick={handleToggle}
          sx={{ position: 'absolute', top: 9, right: 9, backgroundColor: 'rgba(61, 61, 61, 0.8)' }}
          aria-label="toggle card face"
        >
          <SwapHorizIcon />
        </IconButton>
      </Box>
    );
  }

  return delayedSrc ? (
    <Box
      component="img"
      src={delayedSrc}
      alt={altText}
      loading="lazy"
      sx={{ width: '100%', height: 'auto', borderRadius: 1, mb: 2 }}
    />
  ) : (
    <Box
      sx={{
        width: '100%',
        height: 200,
        backgroundColor: 'grey.800',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 1,
        mb: 2,
      }}
    >
      <Typography variant="subtitle1" color="text.secondary">
        No Image
      </Typography>
    </Box>
  );
};

const SearchResults: React.FC<SearchResultsProps> = ({ results, onLoadMore, loadingMore }) => {
  const [cardMenuAnchor, setCardMenuAnchor] = useState<null | HTMLElement>(null);
  const [collectionSelectOpen, setCollectionSelectOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [altSelectedCard, setAltSelectedCard] = useState<Card | null>(null);
  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [altPrintings, setAltPrintings] = useState<Card[]>([]);
  const [altLoading, setAltLoading] = useState(false);
  const [altDialogOpen, setAltDialogOpen] = useState(false);

  const handleRemoveAlternate = (altCard: Card) => {
    setAltPrintings(prev => prev.filter(a => a.id !== altCard.id));
  };

  useEffect(() => {
    if (toast.open) {
      const timer = setTimeout(() => setToast({ ...toast, open: false }), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleCardMenuOpen = (e: MouseEvent<HTMLElement>, card: Card) => {
    setCardMenuAnchor(e.currentTarget);
    setSelectedCard(card);
  };

  const handleCardMenuClose = () => {
    setCardMenuAnchor(null);
    setSelectedCard(null);
  };

  const handleAddToCollection = async () => {
    try {
      const cols = await getCollections();
      if (!cols || cols.length === 0) {
        handleCardMenuClose();
        setOpenCreateDialog(true);
      } else {
        setCollections(cols);
        setCollectionSelectOpen(true);
      }
    } catch {
      setToast({ open: true, message: 'Error loading collections.', severity: 'error' });
      handleCardMenuClose();
    }
  };

  const handleSelectCollection = async (collectionId: number) => {
    try {
      const cardToAdd = altSelectedCard || selectedCard;
      if (cardToAdd) {
        const username = localStorage.getItem('username') || 'default';
        await addCardToCollection(username, collectionId, cardToAdd.card_id.toString());
        setToast({ open: true, message: 'Card added to collection!', severity: 'success' });
      }
    } catch {
      setToast({ open: true, message: 'Error adding card to collection.', severity: 'error' });
    } finally {
      setCollectionSelectOpen(false);
      setSelectedCard(null);
      setAltSelectedCard(null);
    }
  };

  const handleCreateList = async () => {
    try {
      if (!newListName.trim()) {
        setToast({ open: true, message: 'List name is required.', severity: 'error' });
        return;
      }
      const payload: CreateCollectionPayload = {
        label: newListName,
        cardStackStateIndex: 0,
        color: { top: 0xffffff, bottom: 0x8b4513 },
      };
      const newCollection = await createCollection(payload);
      const cardToAdd = altSelectedCard || selectedCard;
      if (cardToAdd) {
        const username = localStorage.getItem('username') || 'default';
        await addCardToCollection(username, newCollection.user_collection_id, cardToAdd.card_id.toString());
        setToast({ open: true, message: 'New list created and card added!', severity: 'success' });
      }
      setOpenCreateDialog(false);
      setNewListName('');
    } catch {
      setToast({ open: true, message: 'Error creating new list.', severity: 'error' });
    }
  };

  const handleShowAlternatePrintings = async () => {
    if (!selectedCard) return;
    setAltLoading(true);
    try {
      const alternate = await getAlternatePrintings(selectedCard.id);
      setAltPrintings(alternate);
      setAltDialogOpen(true);
    } catch {
      setToast({ open: true, message: 'Error fetching alternate printings.', severity: 'error' });
    } finally {
      setAltLoading(false);
      handleCardMenuClose();
    }
  };

  const handleAddAlternateToCollection = async (altCard: Card) => {
    setAltSelectedCard(altCard);
    try {
      const cols = await getCollections();
      if (!cols || cols.length === 0) {
        setAltDialogOpen(false);
        setOpenCreateDialog(true);
      } else {
        setCollections(cols);
        setCollectionSelectOpen(true);
      }
    } catch {
      setToast({ open: true, message: 'Error loading collections.', severity: 'error' });
      setAltSelectedCard(null);
    }
  };

  if (results.length === 0) {
    return (
      <Typography variant="h6" align="center" color="text.secondary" sx={{ mt: 4 }}>
        No results found.
      </Typography>
    );
  }

  return (
    <>
      <Grid container spacing={3}>
        {results.map(card => (
          <Grid item xs={12} sm={6} lg={4} key={card.id} sx={{ display: 'flex' }}>
            <MuiCard
              sx={{
                backgroundColor: 'background.paper',
                borderRadius: 2,
                boxShadow: 3,
                p: 2,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                flexGrow: 1,
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 },
              }}
            >
              {/* Card Header */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" noWrap sx={{ flexGrow: 1, pr: 1 }}>
                  {card.name}
                </Typography>
                {card.mana_cost && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pt: 0.5 }}>
                    {parseManaCost(card.mana_cost)}
                  </Box>
                )}
              </Box>

              {/* Card Image */}
              <ToggleableImage imageData={card.image_uris} altText={card.name} />

              {/* Card Content */}
              <CardContent sx={{ p: 0, flexGrow: 1 }}>
                {card.type_line && (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Type:</strong> {card.type_line}
                    </Typography>
                    <Box sx={{ borderTop: '1px solid #444', my: 1 }} />
                  </>
                )}
                {card.oracle_text && (
                  <Typography variant="body2" color="text.secondary">
                    <strong>Text:</strong> {card.oracle_text}
                  </Typography>
                )}
                {card.flavor_text && (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    {card.flavor_text}
                  </Typography>
                )}
              </CardContent>

              {/* Card Actions */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <IconButton onClick={e => handleCardMenuOpen(e, card)} size="small">
                  <MoreHorizIcon fontSize="small" />
                </IconButton>
              </Box>

              {/* Set Name & Symbol */}
              {(card.set || card.set_name) && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {card.set && <SetSymbol setCode={card.set} style={{ fontSize: '1.2em' }} />}
                    {card.set_name && (
                      <Typography variant="body2" color="text.secondary">
                        {card.set_name}
                      </Typography>
                    )}
                  </Box>
                </>
              )}
            </MuiCard>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Button variant="outlined" onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? <CircularProgress size={24} /> : 'Load More'}
        </Button>
      </Box>

      <Menu anchorEl={cardMenuAnchor} open={Boolean(cardMenuAnchor)} onClose={handleCardMenuClose}>
        <MenuItem onClick={handleAddToCollection}>Add to Collection</MenuItem>
        <MenuItem onClick={handleShowAlternatePrintings}>
          {altLoading ? <CircularProgress size={20} /> : 'Show Alternate Printings'}
        </MenuItem>
      </Menu>

      <Dialog open={collectionSelectOpen} onClose={() => setCollectionSelectOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Select Collection</DialogTitle>
        <DialogContent>
          {collections.map(col => (
            <Box key={col.user_collection_id} sx={{ my: 1 }}>
              <Button variant="outlined" fullWidth onClick={() => handleSelectCollection(col.user_collection_id)}>
                {col.label}
              </Button>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCollectionSelectOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)}>
        <DialogTitle>Create New List</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="List Name"
            fullWidth
            value={newListName}
            onChange={e => setNewListName(e.target.value)}
          />
          <Typography variant="caption" color="text.secondary">
            (Placeholder: colors and state = 0)
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateList}>Create List</Button>
        </DialogActions>
      </Dialog>

      <AlternatePrintingsDialog
        open={altDialogOpen}
        onClose={() => setAltDialogOpen(false)}
        altPrintings={altPrintings}
        dialogMode="search"
        handleAddAlternateToCollection={handleAddAlternateToCollection}
        handleRemoveAlternate={handleRemoveAlternate}
      />

      <Portal>
        {toast.open && (
          <Box
            sx={{
              position: 'fixed',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              width: '90%',
              maxWidth: 400,
            }}
          >
            <Alert severity={toast.severity} variant="filled">
              {toast.message}
            </Alert>
          </Box>
        )}
      </Portal>
    </>
  );
};

export default SearchResults;
