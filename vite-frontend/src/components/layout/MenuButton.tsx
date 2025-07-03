// src/components/layout/MenuButton.tsx

import React from 'react';
import { createRoot } from 'react-dom/client';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';

interface MenuButtonProps {
  onClick: () => void;
}

const MenuButton: React.FC<MenuButtonProps> = ({ onClick }) => {
  return (
    <IconButton
      color="inherit"
      edge="start"
      onClick={onClick}
      aria-label="Open navigation menu"
      sx={{
        width: 40,
        height: 40,
        p: 1,
      }}
    >
      <MenuIcon />
    </IconButton>
  );
};

export const mountMenuButton = (onClick: () => void) => {
  const container = document.getElementById('menu-button-root');
  if (container) {
    createRoot(container).render(<MenuButton onClick={onClick} />);
  }
};

export default MenuButton;
