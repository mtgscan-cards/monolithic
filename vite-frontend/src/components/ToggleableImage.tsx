import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Fade } from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { Card } from './SearchResults';

// Updated ToggleableImage component: always renders the png image.
const ToggleableImage: React.FC<{ imageData: Card['image_uris']; altText: string }> = ({
  imageData,
  altText,
}) => {
  const [currentFace, setCurrentFace] = useState(0);
  const [fade, setFade] = useState(true);
  const [delayedSrc, setDelayedSrc] = useState<string | undefined>(undefined);

  // Determine target source using the 'png' property
  let targetSrc: string | undefined;
  if (!imageData) {
    targetSrc = undefined;
  } else if (Array.isArray(imageData)) {
    // If the card is double-faced, use the png of the current face.
    targetSrc = imageData.length === 2 ? imageData[currentFace]?.png : imageData[0]?.png;
  } else {
    targetSrc = imageData.png;
  }

  // Simulate delay before loading the image.
  useEffect(() => {
    // Using a simple delay function here (adjust as needed).
    const delay = setTimeout(() => {
      setDelayedSrc(targetSrc);
    }, 100);
    return () => clearTimeout(delay);
  }, [targetSrc]);

  const handleToggle = () => {
    setFade(false);
    setTimeout(() => {
      setCurrentFace((prev) => (prev === 0 ? 1 : 0));
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
          sx={{
            position: 'absolute',
            top: 9,
            right: 9,
            backgroundColor: 'rgba(61, 61, 61, 0.8)',
          }}
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

export default ToggleableImage;
