// vite-frontend/src/pages/CollectionPortfolio/ChartPanel.tsx

import React, { useEffect } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Line } from 'react-chartjs-2';
import {
    ChartData,
    ChartOptions,
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { CollectionData } from '../../api/collections';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface Props {
    selectedCollectionId: number | null;
    collections: CollectionData[];
    mergedData: { snapshot_date: string;[key: string]: number | string }[];
    chartData: ChartData<'line'>;
    chartOptions: ChartOptions<'line'>;
    currentValue: number;
    dollarChange: number;
    rangeLabel: string;
    loading: boolean;
    error: string | null;
}

const ChartPanel: React.FC<Props> = ({
    selectedCollectionId,
    collections,
    mergedData,
    chartData,
    chartOptions,
    currentValue,
    dollarChange,
    rangeLabel,
    loading,
    error,
}) => {
    useEffect(() => {
        console.debug('[ChartPanel] Mount or Update');
        console.debug('selectedCollectionId:', selectedCollectionId);
        console.debug('collections:', collections);
        console.debug('mergedData.length:', mergedData.length);
        console.debug('chartData.labels?.length:', chartData.labels?.length ?? 0);
        console.debug('loading:', loading);
        console.debug('error:', error);
    }, [selectedCollectionId, collections, mergedData, chartData, loading, error]);

    const hasValidChartData =
        selectedCollectionId !== null &&
        collections.length > 0 &&
        mergedData.length > 0 &&
        Array.isArray(chartData.labels) &&
        (chartData.labels?.length ?? 0) > 0 &&
        !loading &&
        !error;

    if (!loading && !error && collections.length === 0) {
        console.warn('[ChartPanel] No collections to show');
        return (
            <Paper
                sx={{
                    mt: 4,
                    p: 3,
                    textAlign: 'center',
                    backgroundColor: '#1E1E1E',
                    borderRadius: 2,
                }}
            >
                <Typography variant="h6">No collections yet</Typography>
                <Typography variant="body1" sx={{ color: '#aaa' }}>
                    <a href="/collections" style={{ color: '#36A2EB', textDecoration: 'underline' }}>
                        Create a collection
                    </a>{' '}
                    and add cards to begin tracking.
                </Typography>
            </Paper>
        );
    }

    if (
        !loading &&
        !error &&
        selectedCollectionId &&
        collections.length > 0 &&
        mergedData.length === 0
    ) {
        console.warn('[ChartPanel] No data points yet for selected collection');
        return (
            <Paper
                sx={{
                    mt: 4,
                    p: 3,
                    textAlign: 'center',
                    backgroundColor: '#1E1E1E',
                    borderRadius: 2,
                }}
            >
                <Typography variant="h6">Nothing to show yet</Typography>
                <Typography variant="body1" sx={{ color: '#aaa' }}>
                    Add cards to your collection to start tracking values.
                </Typography>
            </Paper>
        );
    }

    if (hasValidChartData) {
        const chartKey = `${selectedCollectionId}-${mergedData.length}-${chartData.labels!.length}`;
        console.info('[ChartPanel] Rendering chart with key:', chartKey);

        return (
            <>
                <Paper
                    sx={{
                        mt: 4,
                        mb: 2,
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: '#1E1E1E',
                        textAlign: 'center',
                    }}
                >
                    <Typography variant="h5">Current Value: ${currentValue.toFixed(2)}</Typography>
                    <Typography
                        variant="body1"
                        sx={{
                            color: dollarChange >= 0 ? 'limegreen' : 'red',
                            fontWeight: 'bold',
                        }}
                    >
                        {dollarChange >= 0 ? '+' : '-'}${Math.abs(dollarChange).toFixed(2)} ({rangeLabel})
                    </Typography>
                </Paper>

                <Box sx={{ mt: 2, backgroundColor: '#222', p: 2, borderRadius: 2 }}>
                    <Line
                        key={chartKey}
                        data={chartData}
                        options={chartOptions}
                        className="fade-canvas"
                        data-ready={hasValidChartData}
                    />
                </Box>
            </>
        );
    }

    console.debug('[ChartPanel] Skipping render — data not ready');
    return null;
};

export default ChartPanel;
