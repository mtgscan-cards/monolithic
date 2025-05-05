import React from 'react';
import { Card, CardMedia, CardContent, Typography, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SetSymbol from './utils/SetSymbol';
import { ScannedCard } from '../hooks/useFrameProcessor';

interface LastScannedCardProps {
  card: ScannedCard;
  onRemove: (cardId: string) => void;
  onAlternate: () => void;
}

const LastScannedCard: React.FC<LastScannedCardProps> = ({ card, onRemove, onAlternate }) => {
  return (
    <Card sx={{ position: 'relative', display: 'flex', alignItems: 'center', padding: 2 }}>
      {/* Remove Button */}
      <IconButton
        sx={{ position: 'absolute', top: 4, right: 4 }}
        onClick={() => onRemove(card.id)}
      >
        <CloseIcon />
      </IconButton>
      {/* Alternate Printings Button */}
      <IconButton
        sx={{ position: 'absolute', bottom: 4, right: 4 }}
        onClick={onAlternate}
      >
        <SwapHorizIcon />
      </IconButton>
      <CardMedia
        component="img"
        image={card.imageUri}
        alt={card.name}
        sx={{ width: 150, height: 'auto', borderRadius: 1, mr: 2 }}
      />
      <CardContent>
        <Typography variant="h5" gutterBottom>
          {card.name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="body1" sx={{ mr: 1 }}>
            {card.setName}
          </Typography>
          <SetSymbol setCode={card.set} style={{ fontSize: '1.5rem' }} />
        </Box>
        <Typography variant="body2" color="textSecondary">
          Price: {card.foil ? card.prices.foil : card.prices.normal} USD
        </Typography>
      </CardContent>
    </Card>
  );
};

export default LastScannedCard;
