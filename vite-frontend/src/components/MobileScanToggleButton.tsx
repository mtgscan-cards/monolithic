import React from 'react';
import { Button } from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';

interface Props {
  isOpen: boolean;
  onClick: () => void;
}

const MobileScanToggleButton: React.FC<Props> = ({ isOpen, onClick }) => {
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
