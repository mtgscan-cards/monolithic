import React from 'react';
import { Paper, Typography, Grid, TextField, Button } from '@mui/material';

interface Props {
    label: string;
    topColor: string;
    bottomColor: string;
    setLabel: (v: string) => void;
    setTopColor: (v: string) => void;
    setBottomColor: (v: string) => void;
    handleAdd: () => void;
}

export const CreateCollectionForm: React.FC<Props> = ({
    label,
    topColor,
    bottomColor,
    setLabel,
    setTopColor,
    setBottomColor,
    handleAdd,
}) => (
    <Paper
        elevation={4}
        sx={{
            position: 'fixed',
            bottom: 120,
            left: '50%',
            transform: 'translateX(-50%)',
            width: { xs: '90%', sm: 400 },
            maxHeight: '50vh',
            overflowY: 'auto',
            p: 3,
            bgcolor: 'rgba(0,0,0,0.75)',
            color: 'white',
            borderRadius: 2,
            zIndex: 1,
        }}
    >
        <Typography variant="h6" gutterBottom>
            Create New Collection
        </Typography>
        <Grid container spacing={2}>
            <Grid item xs={12}>
                <TextField
                    label="Label"
                    fullWidth
                    variant="filled"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                />
            </Grid>
            <Grid item xs={6}>
                <TextField
                    label="Top Color"
                    type="color"
                    fullWidth
                    variant="filled"
                    value={topColor}
                    onChange={(e) => setTopColor(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                />
            </Grid>
            <Grid item xs={6}>
                <TextField
                    label="Bottom Color"
                    type="color"
                    fullWidth
                    variant="filled"
                    value={bottomColor}
                    onChange={(e) => setBottomColor(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                />
            </Grid>
            <Grid item xs={12}>
                <Button onClick={handleAdd} variant="contained" fullWidth>
                    Create Collection
                </Button>
            </Grid>
        </Grid>
    </Paper>
);
