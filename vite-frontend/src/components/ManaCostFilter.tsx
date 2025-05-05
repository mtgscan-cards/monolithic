// src/components/ManaCostFilter.tsx
import React, { useState } from 'react';
import {
  Box,
  Button,
  Grid,
  MenuItem,
  Select,
  TextField,
  Typography,
  Alert,
  Paper,
  SelectChangeEvent,
} from '@mui/material';

type Operator = '<' | '>' | '=' | 'between';

interface ManaCostFilterProps {
  onAdd: (filter: { operator: Operator; value: number | [number, number] }) => void;
}

const ManaCostFilter: React.FC<ManaCostFilterProps> = ({ onAdd }) => {
  const [operator, setOperator] = useState<Operator>('<');
  const [value, setValue] = useState<number>(0);
  const [minValue, setMinValue] = useState<number>(0);
  const [maxValue, setMaxValue] = useState<number>(10);
  const [error, setError] = useState<string | null>(null);

  const validateValues = () => {
    if (operator === 'between') {
      if (minValue < 0 || maxValue < 0) {
        return 'Values cannot be less than 0.';
      }
      if (minValue > maxValue) {
        return 'Minimum value cannot be greater than maximum value.';
      }
    } else {
      if (value < 0) {
        return 'Value cannot be less than 0.';
      }
    }
    return null;
  };

  const handleAdd = () => {
    const validationError = validateValues();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    if (operator === 'between') {
      onAdd({ operator, value: [minValue, maxValue] });
    } else {
      onAdd({ operator, value });
    }
  };

  const handleOperatorChange = (e: SelectChangeEvent<Operator>) => {
    setOperator(e.target.value as Operator);
    setError(null);
  };

  return (
    <Paper
      sx={{
        p: 2,
        mb: 2,
        backgroundColor: 'background.paper',
        borderRadius: 2,
      }}
    >
      <Typography variant="h6" gutterBottom>
        Mana Cost Filter
      </Typography>
      <Grid container spacing={2} alignItems="center">
        {operator === 'between' ? (
          <>
            <Grid item>
              <Typography variant="body1">
                Show cards with converted mana cost between
              </Typography>
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                type="number"
                variant="outlined"
                inputProps={{ min: 0 }}
                value={minValue}
                onChange={(e) => setMinValue(Number(e.target.value))}
                sx={{
                  backgroundColor: 'background.default',
                  borderRadius: 1,
                }}
              />
            </Grid>
            <Grid item>
              <Typography variant="body1">and</Typography>
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                type="number"
                variant="outlined"
                inputProps={{ min: 0 }}
                value={maxValue}
                onChange={(e) => setMaxValue(Number(e.target.value))}
                sx={{
                  backgroundColor: 'background.default',
                  borderRadius: 1,
                }}
              />
            </Grid>
            <Grid item xs="auto">
              <Button variant="contained" onClick={handleAdd}>
                Add Filter
              </Button>
            </Grid>
          </>
        ) : (
          <>
            <Grid item>
              <Typography variant="body1">
                Show cards with converted mana cost
              </Typography>
            </Grid>
            <Grid item xs={3}>
              <Select
                fullWidth
                variant="outlined"
                value={operator}
                onChange={handleOperatorChange}
                sx={{
                  backgroundColor: 'background.default',
                  borderRadius: 1,
                }}
              >
                <MenuItem value="<">less than</MenuItem>
                <MenuItem value=">">greater than</MenuItem>
                <MenuItem value="=">equal to</MenuItem>
              </Select>
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                type="number"
                variant="outlined"
                inputProps={{ min: 0 }}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                sx={{
                  backgroundColor: 'background.default',
                  borderRadius: 1,
                }}
              />
            </Grid>
            <Grid item xs="auto">
              <Button variant="contained" onClick={handleAdd}>
                Add Filter
              </Button>
            </Grid>
          </>
        )}
      </Grid>
      {error && (
        <Box sx={{ mt: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}
    </Paper>
  );
};

export default ManaCostFilter;