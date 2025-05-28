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
    <Card
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 2,
        width: '100%',
        overflow: 'hidden',
        maxWidth: '100%',
      }}
    >
      {/* Remove Button */}
      <IconButton
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
          zIndex: 1,
        }}
        onClick={() => onRemove(card.id)}
      >
        <CloseIcon />
      </IconButton>

      {/* Alternate Printings Button */}
      <IconButton
        sx={{
          position: 'absolute',
          bottom: 4,
          right: 4,
          zIndex: 1,
        }}
        onClick={onAlternate}
      >
        <SwapHorizIcon />
      </IconButton>

      <CardMedia
        component="img"
        image={card.imageUri}
        alt={card.name}
        sx={{
          width: 100,
          height: 'auto',
          borderRadius: 1,
          flexShrink: 0,
          mr: 2,
        }}
      />

      <CardContent sx={{ padding: 0, overflow: 'hidden' }}>
        <Typography
          variant="h6"
          gutterBottom
          noWrap
          sx={{ maxWidth: '100%' }}
        >
          {card.name}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
          <Typography
            variant="body1"
            sx={{ mr: 1 }}
            noWrap
          >
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
