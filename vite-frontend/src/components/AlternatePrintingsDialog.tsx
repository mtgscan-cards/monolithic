import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Grid,
  Card as MuiCard,
  Button,
  Box,
  Divider,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ToggleableImage from './ToggleableImage'; // Ensure this path is correct
import SetSymbol from './utils/SetSymbol';

export interface Card {
  id: string;                    // Scryfall UUID
  card_id: number;              // Required for collection additions
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
  lang?: string;
  layout?: string;
}

interface AlternatePrintingsDialogProps {
  open: boolean;
  onClose: () => void;
  altPrintings: Card[];
  dialogMode: 'scan' | 'search';
  handleAddAlternateToCollection?: (altCard: Card) => void;
  handleSwitchAlternate?: (altCard: Card) => void;
  handleRemoveAlternate: (altCard: Card) => void;
}

const AlternatePrintingsDialog: React.FC<AlternatePrintingsDialogProps> = ({
  open,
  onClose,
  altPrintings,
  dialogMode,
  handleAddAlternateToCollection,
  handleSwitchAlternate,
  handleRemoveAlternate,
}) => {
  const [languageFilter, setLanguageFilter] = useState<string>('en');

  const languageOptions = useMemo(() => {
    const langs = altPrintings
      .map((card) => card.lang)
      .filter((lang): lang is string => Boolean(lang));
    return Array.from(new Set(langs));
  }, [altPrintings]);

  const filteredAltPrintings = useMemo(() => {
    if (languageFilter === 'all') return altPrintings;
    return altPrintings.filter((card) => card.lang === languageFilter);
  }, [altPrintings, languageFilter]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Alternate Printings</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="language-select-label">Language</InputLabel>
            <Select
              labelId="language-select-label"
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
              label="Language"
            >
              <MenuItem value="all">All</MenuItem>
              {languageOptions.map((lang) => (
                <MenuItem key={lang} value={lang}>
                  {lang}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        {filteredAltPrintings.length === 0 ? (
          <Typography>No alternate printings found for the selected language.</Typography>
        ) : (
          <Grid container spacing={2}>
            {filteredAltPrintings.map((altCard) => (
              <Grid item xs={12} sm={6} md={4} key={altCard.id}>
                <MuiCard sx={{ p: 1, position: 'relative' }}>
                  <IconButton
                    sx={{ position: 'absolute', top: 4, right: 4 }}
                    onClick={() => handleRemoveAlternate(altCard)}
                  >
                    <CloseIcon />
                  </IconButton>
                  <Typography variant="subtitle1" noWrap>
                    {altCard.name}
                  </Typography>
                  {altCard.image_uris && (
                    <ToggleableImage imageData={altCard.image_uris} altText={altCard.name} />
                  )}
                  {(altCard.set || altCard.set_name || altCard.lang || altCard.layout) && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {altCard.set && <SetSymbol setCode={altCard.set} style={{ fontSize: '1.2em' }} />}
                          {altCard.set_name && (
                            <Typography variant="body2" color="text.secondary">
                              {altCard.set_name}
                            </Typography>
                          )}
                        </Box>
                        {altCard.lang && (
                          <Typography variant="caption" color="text.secondary">
                            Language: {altCard.lang}
                          </Typography>
                        )}
                        {altCard.layout && (
                          <Typography variant="caption" color="text.secondary">
                            Layout: {altCard.layout}
                          </Typography>
                        )}
                      </Box>
                    </>
                  )}
                  <Box
                    sx={{
                      textAlign: 'center',
                      mt: 1,
                      display: 'flex',
                      gap: 1,
                      justifyContent: 'center',
                    }}
                  >
                    {dialogMode === 'search' && handleAddAlternateToCollection && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleAddAlternateToCollection(altCard)}
                      >
                        Add to Collection
                      </Button>
                    )}
                    {dialogMode === 'scan' && handleSwitchAlternate && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleSwitchAlternate(altCard)}
                      >
                        Switch Card
                      </Button>
                    )}
                  </Box>
                </MuiCard>
              </Grid>
            ))}
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AlternatePrintingsDialog;
