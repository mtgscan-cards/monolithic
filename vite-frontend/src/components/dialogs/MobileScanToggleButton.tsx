import React from 'react';
import { Button, useMediaQuery, useTheme } from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';

interface Props {
  isOpen: boolean;
  onClick: () => void;
}

const MobileScanToggleButton: React.FC<Props> = ({ isOpen, onClick }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (isMobile) return null; // Don't render on mobile devices

  return (
    <Button
      variant="outlined"
      onClick={onClick}
      endIcon={isOpen ? <ExpandLess /> : <ExpandMore />}
    >
      {isOpen ? 'Hide Mobile Scan' : 'Scan with Your Phone'}
    </Button>
  );
};

export default MobileScanToggleButton;