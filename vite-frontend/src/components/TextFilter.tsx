// src/components/TextFilter.tsx
import React, { useState } from 'react';
import { Box, Paper, TextField, Button, Typography } from '@mui/material';

interface TextFilterProps {
  selectedTexts: string[];
  onAdd: (text: string) => void;
}

const TextFilter: React.FC<TextFilterProps> = ({ onAdd }) => {
  const [input, setInput] = useState<string>('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (trimmed !== '') {
      onAdd(trimmed);
      setInput('');
    }
  };

  return (
    <Paper
      sx={{
        p: 3,
        mb: 2,
        backgroundColor: 'background.paper',
        borderRadius: 2,
        boxShadow: 3,
      }}
    >
      <Typography variant="h6" gutterBottom>
        Text Filter
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <TextField
          variant="outlined"
          fullWidth
          placeholder="Enter filter text..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          size="small"
          sx={{ backgroundColor: 'background.default', borderRadius: 1 }}
        />
        <Button variant="contained" onClick={handleAdd} sx={{ textTransform: 'none' }}>
          Add
        </Button>
      </Box>
    </Paper>
  );
};

export default TextFilter;