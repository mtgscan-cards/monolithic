// src/components/ColorFilter.tsx
import React from 'react';
import { Paper, Typography, ToggleButton, ToggleButtonGroup, Box } from '@mui/material';
import { parseManaCost } from '../utils/parseManaCost';

interface ColorFilterProps {
  selectedColors: string[];
  onChange: (selectedColors: string[]) => void;
}

interface ColorOption {
  name: string;
  code: string;
}

const colorOptions: ColorOption[] = [
  { name: "White", code: "W" },
  { name: "Blue", code: "U" },
  { name: "Black", code: "B" },
  { name: "Red", code: "R" },
  { name: "Green", code: "G" },
  { name: "Colorless", code: "C" },
];

const ColorFilter: React.FC<ColorFilterProps> = ({ selectedColors, onChange }) => {
  const handleColorChange = (
    _: React.MouseEvent<HTMLElement>, // renamed to _
    newColors: string[]
  ) => {
    if (newColors !== null) {
      onChange(newColors);
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 2, backgroundColor: 'background.paper',        borderRadius: 2,
      boxShadow: 3 }}>
      <Typography variant="h6" gutterBottom>
        Colors
      </Typography>
      <ToggleButtonGroup
        value={selectedColors}
        onChange={handleColorChange}
        aria-label="color filter"
        sx={{
          flexWrap: 'wrap',
          gap: 1,
          // Override grouped styles completely for consistent rounding
          '& .MuiToggleButtonGroup-grouped': {
            margin: 0,
            border: 'none',
            borderRadius: 1, // Set uniform border radius on all corners
          },
        }}
      >
        {colorOptions.map((option) => (
          <ToggleButton
            key={option.code}
            value={option.code}
            aria-label={option.name}
            disableRipple
            sx={{
              width: 40,
              height: 40,
              p: 0,
              border: 'none',
              backgroundColor: 'transparent',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s ease',
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                border: 'none',
              },
              '&:hover': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                border: 'none',
              },
              '&:focus': {
                outline: 'none',
                border: 'none',
              },
            }}
          >
            <Box
              sx={{
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {parseManaCost(`{${option.code}}`)}
            </Box>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Paper>
  );
};

export default ColorFilter;
