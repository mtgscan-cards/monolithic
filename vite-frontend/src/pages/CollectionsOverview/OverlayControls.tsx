import React from 'react';
import { Box, Button } from '@mui/material';

export const FullOverlay: React.FC<React.PropsWithChildren> = ({ children }) => (
    <Box
        sx={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            bgcolor: 'rgba(0,0,0,0.6)',
            zIndex: 1,
        }}
    >
        {children}
    </Box>
);

export const Banner: React.FC<React.PropsWithChildren> = ({ children }) => (
    <Box
        sx={{
            position: 'fixed',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            px: 3,
            py: 2,
            bgcolor: 'rgba(0,0,0,0.75)',
            borderRadius: 2,
            color: 'white',
            textAlign: 'center',
            zIndex: 1,
        }}
    >
        {children}
    </Box>
);

interface NavButtonProps {
    right?: boolean;
    disabled?: boolean;
    onClick: () => void;
}

export const NavButton: React.FC<React.PropsWithChildren<NavButtonProps>> = ({
    right = false,
    disabled,
    onClick,
    children,
}) => (
    <Button
        disabled={disabled}
        onClick={onClick}
        sx={{
            position: 'fixed',
            top: '50%',
            transform: 'translateY(-50%)',
            [right ? 'right' : 'left']: 16,
            fontSize: '2rem',
            color: 'white',
            minWidth: 0,
            opacity: disabled ? 0.3 : 1,
            pointerEvents: disabled ? 'none' : 'auto',
            zIndex: 1,
        }}
    >
        {children}
    </Button>
);
