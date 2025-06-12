import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Paper
} from '@mui/material';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { getCollectionValueHistory } from '../../api/price';
import { getCollections, CollectionData } from '../../api/collections';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface HistoryDataPoint {
  snapshot_date: string;  // e.g. "2025-04-01"
  total_value: string;    // e.g. "123.45"
}

interface CollectionHistory {
  collectionId: number;
  label: string;
  history: HistoryDataPoint[];
}

// Merged data for charting
interface MergedDataPoint {
  snapshot_date: string;
  [collectionLabel: string]: number | string;
}

const CollectionPortfolioPage: React.FC = () => {
  // Note: selectedCollectionId now holds the per-user collection ID.
  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<string>('all');
  const [portfolioData, setPortfolioData] = useState<CollectionHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
  if (collections.length > 0 && selectedCollectionId == null) {
    setSelectedCollectionId(collections[0].user_collection_id);
  }
}, [collections, selectedCollectionId]);
  // Fetch user's collections on mount
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const data = await getCollections();
        setCollections(data);
      } catch {
        setError('Failed to load collections');
      }
    };
    fetchCollections();
  }, []);

// Fetch historical data for the selected collection and time range
useEffect(() => {
  if (selectedCollectionId == null) {
    setPortfolioData([]);
    setLoading(false);
    return;
  }

  // Find the collection object by its per-user ID
  const coll = collections.find(c => c.user_collection_id === selectedCollectionId);
  if (!coll) {
    setError(`Collection ${selectedCollectionId} not found`);
    setPortfolioData([]);
    setLoading(false);
    return;
  }

  const globalId = coll.global_id;  // ← use the true PK for the API

  setLoading(true);
  const fetchHistory = async () => {
    try {
      // Pass the global collection ID to the history endpoint
      const historyResponse = await getCollectionValueHistory(globalId, timeRange);
      setPortfolioData([
        {
          collectionId: globalId,
          label:        coll.label,
          history:      historyResponse.history
        }
      ]);
    } catch {
      setError('Failed to load collection history data');
    } finally {
      setLoading(false);
    }
  };

  fetchHistory();
}, [selectedCollectionId, collections, timeRange]);

  // Merge data for charting
  const mergedData: MergedDataPoint[] = useMemo(() => {
    if (portfolioData.length === 0) return [];
    const dataMap: { [date: string]: { [key: string]: number } } = {};
    const series = portfolioData[0];
    series.history.forEach((point) => {
      const date = point.snapshot_date;
      const value = parseFloat(point.total_value);
      if (!dataMap[date]) {
        dataMap[date] = {};
      }
      dataMap[date][series.label] = value;
    });
    const mergedArray = Object.entries(dataMap).map(([date, values]) => ({
      snapshot_date: date,
      ...values,
    })) as MergedDataPoint[];
    mergedArray.sort(
      (a, b) =>
        new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
    );
    return mergedArray;
  }, [portfolioData]);

  // Prepare data for react-chartjs-2.
  const chartData = useMemo(() => {
    if (mergedData.length === 0 || portfolioData.length === 0) {
      return { labels: [], datasets: [] };
    }
    const series = portfolioData[0];
    const labels = mergedData.map((m) =>
      new Date(m.snapshot_date).toLocaleDateString()
    );
    const data = mergedData.map((m) => m[series.label] ?? null);
    const color = '#36A2EB';
    return {
      labels,
      datasets: [
        {
          label: series.label,
          data,
          borderColor: color,
          backgroundColor: color,
          tension: 0.2,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  }, [mergedData, portfolioData]);

  // Chart options with dark theme adjustments
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { 
        position: 'top' as const,
        labels: {
          color: '#fff',
          font: { size: 14 },
        },
      },
      title: {
        display: true,
        text: 'Collection Value Over Time (USD)',
        color: '#fff',
        font: { size: 16 },
      },
      tooltip: {
        backgroundColor: '#333',
        titleColor: '#fff',
        bodyColor: '#fff',
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Date', color: '#fff' },
        ticks: { color: '#fff' },
        grid: { color: '#444' },
      },
      y: {
        title: { display: true, text: 'Total Value (USD)', color: '#fff' },
        ticks: { color: '#fff' },
        grid: { color: '#444' },
      },
    },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart' as const,
    },
  };

  // Compute current value & dollar change over selected range
  const [currentValue, dollarChange, rangeLabel] = useMemo(() => {
    if (mergedData.length === 0 || portfolioData.length === 0) {
      return [0, 0, ''];
    }
    const series = portfolioData[0];
    const current = (mergedData[mergedData.length - 1][series.label] as number) || 0;
    const earliest = (mergedData[0][series.label] as number) || 0;
    const change = current - earliest;
    let label = '';
    if (timeRange === '3d') {
      label = 'last 3 days';
    } else if (timeRange === '1w') {
      label = 'last week';
    } else if (timeRange === '2w') {
      label = 'last 2 weeks';
    } else if (timeRange === '1m') {
      label = 'last month';
    } else if (timeRange === 'all') {
      label = 'all time';
    }
    return [current, change, label];
  }, [mergedData, portfolioData, timeRange]);

   return (
    <Container sx={{ mt: 4, color: '#fff' }}>
      <Typography variant="h4" gutterBottom>
        Collection Portfolio Overview
      </Typography>

      <FormControl sx={{ mt: 2, minWidth: 300, backgroundColor: '#333', borderRadius: 1 }}>
        <InputLabel id="collection-select-label" sx={{ color: '#fff' }}>Select Collection</InputLabel>
        <Select
          labelId="collection-select-label"
          value={selectedCollectionId ?? ''}
          onChange={(e) => setSelectedCollectionId(e.target.value as number)}
          input={<OutlinedInput label="Select Collection" sx={{ color: '#fff', borderColor: '#fff' }} />}
          sx={{
            '.MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#36A2EB' },
            color: '#fff'
          }}
          disabled={collections.length === 0}
        >
          {collections.map((coll) => (
            <MenuItem key={coll.user_collection_id} value={coll.user_collection_id}>
              {coll.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Time Range Filter */}
      <Box sx={{ mt: 2 }}>
        <ToggleButtonGroup
          value={timeRange}
          exclusive
          onChange={(_, newRange) => {
            if (newRange) setTimeRange(newRange);
          }}
          sx={{
            backgroundColor: '#333',
            borderRadius: 1,
          }}
        >
          <ToggleButton value="3d">3d</ToggleButton>
          <ToggleButton value="1w">1W</ToggleButton>
          <ToggleButton value="2w">2W</ToggleButton>
          <ToggleButton value="1m">1M</ToggleButton>
          <ToggleButton value="all">All</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loading && <CircularProgress sx={{ mt: 2, color: '#36A2EB' }} />}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      {/* Big number + dollar change block */}
      {selectedCollectionId && mergedData.length > 0 && (
        <Paper
          elevation={3}
          sx={{
            mt: 4,
            mb: 2,
            p: 2,
            borderRadius: 2,
            backgroundColor: '#1E1E1E',
            textAlign: 'center',
          }}
        >
          <Typography variant="h5" sx={{ mb: 1 }}>
            Current Value: ${currentValue.toFixed(2)}
          </Typography>
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
      )}

      {mergedData.length > 0 && (
        <Box sx={{ mt: 2, backgroundColor: '#222', p: 2, borderRadius: 2 }}>
          <Line data={chartData} options={chartOptions} />
        </Box>
      )}

      {/* No collections exist at all */}
      {!loading && !error && collections.length === 0 && (
        <Paper
          elevation={3}
          sx={{
            mt: 4,
            p: 3,
            textAlign: 'center',
            backgroundColor: '#1E1E1E',
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" gutterBottom>
            No collections yet
          </Typography>
            <Typography variant="body1" sx={{ color: '#aaa' }}>
            <a
              href="/collections"
              style={{
              color: '#36A2EB',
              textDecoration: 'underline',
              fontWeight: 500,
              }}
            >
              Create a collection
            </a>{' '}
            and add some cards to start tracking prices over time.
            </Typography>
        </Paper>
      )}

      {/* Collection selected, but no history data yet */}
      {!loading && !error && selectedCollectionId && collections.length > 0 && mergedData.length === 0 && (
        <Paper
          elevation={3}
          sx={{
            mt: 4,
            p: 3,
            textAlign: 'center',
            backgroundColor: '#1E1E1E',
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" gutterBottom>
            Nothing to show here yet
          </Typography>
          <Typography variant="body1" sx={{ color: '#aaa' }}>
            Add some cards to your collection to enable price tracking over time.
          </Typography>
        </Paper>
      )}
    </Container>
  );
};

export default CollectionPortfolioPage;
