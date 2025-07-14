import React from 'react';
import { Container, Typography, CircularProgress, Alert } from '@mui/material';
import { usePortfolioData } from './usePortfolioData';
import CollectionSelector from './CollectionSelector';
import TimeRangeToggle from './TimeRangeToggle';
import ChartPanel from './ChartPanel';

const CollectionPortfolio: React.FC = () => {
  const {
    collections,
    selectedCollectionId,
    setSelectedCollectionId,
    timeRange,
    setTimeRange,
    loading,
    error,
    mergedData,
    chartData,
    chartOptions,
    currentValue,
    dollarChange,
    rangeLabel
  } = usePortfolioData();

  return (
    <Container sx={{ mt: 4, color: '#fff' }}>
      <Typography variant="h4" gutterBottom>
        Collection Portfolio Overview
      </Typography>

      <CollectionSelector
        collections={collections}
        selectedCollectionId={selectedCollectionId}
        setSelectedCollectionId={setSelectedCollectionId}
      />

      <TimeRangeToggle timeRange={timeRange} setTimeRange={setTimeRange} />

      {loading && <CircularProgress sx={{ mt: 2, color: '#36A2EB' }} />}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      <ChartPanel
        selectedCollectionId={selectedCollectionId}
        collections={collections}
        mergedData={mergedData}
        chartData={chartData}
        chartOptions={chartOptions}
        currentValue={currentValue}
        dollarChange={dollarChange}
        rangeLabel={rangeLabel}
        loading={loading}
        error={error}
      />
    </Container>
  );
};

export default CollectionPortfolio;
