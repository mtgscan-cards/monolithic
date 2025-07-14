import { useState, useEffect, useMemo } from 'react';
import { getCollections, CollectionData } from '../../api/collections';
import { getCollectionValueHistory } from '../../api/price';

interface HistoryDataPoint {
  snapshot_date: string;
  total_value: string;
}

interface CollectionHistory {
  collectionId: number;
  label: string;
  history: HistoryDataPoint[];
}

interface MergedDataPoint {
  snapshot_date: string;
  [collectionLabel: string]: number | string;
}

export function usePortfolioData() {
  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState('all');
  const [portfolioData, setPortfolioData] = useState<CollectionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load collections
  useEffect(() => {
    getCollections()
      .then((data) => {
        setCollections(data);
        if (data.length > 0) {
          setSelectedCollectionId(data[0].user_collection_id);
        }
      })
      .catch(() => setError('Failed to load collections'));
  }, []);

  // Load collection value history
  useEffect(() => {
    if (!selectedCollectionId || collections.length === 0) return;

    const collection = collections.find((c) => c.user_collection_id === selectedCollectionId);
    if (!collection) return;

    setLoading(true);

    getCollectionValueHistory(collection.global_id, timeRange)
      .then((res) => {
        setPortfolioData([
          {
            collectionId: collection.global_id,
            label: collection.label,
            history: res.history,
          },
        ]);
      })
      .catch(() => setError('Failed to load collection history data'))
      .finally(() => setLoading(false));
  }, [selectedCollectionId, timeRange, collections]);

  // Merge history data into chart-friendly format
  const mergedData: MergedDataPoint[] = useMemo(() => {
    if (portfolioData.length === 0) return [];

    const result: Record<string, Record<string, number>> = {};
    const { label, history } = portfolioData[0];

    for (const point of history) {
      const dateMap = result[point.snapshot_date] || {};
      dateMap[label] = parseFloat(point.total_value);
      result[point.snapshot_date] = dateMap;
    }

    return Object.entries(result)
      .map(([snapshot_date, values]) => ({ snapshot_date, ...values }))
      .sort(
        (a, b) =>
          new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
      );
  }, [portfolioData]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (mergedData.length === 0) return { labels: [], datasets: [] };

    const { label } = portfolioData[0];
    const color = '#36A2EB';

    return {
      labels: mergedData.map((point) =>
        new Date(point.snapshot_date).toLocaleDateString()
      ),
      datasets: [
        {
          label,
          data: mergedData.map((point) => {
            const val = point[label];
            return typeof val === 'number' ? val : null;
          }),
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
  };

  // Compute current value, change, and label
  const [currentValue, dollarChange, rangeLabel] = useMemo(() => {
    if (mergedData.length === 0) return [0, 0, ''];

    const { label } = portfolioData[0];
    const first = mergedData[0]?.[label];
    const last = mergedData[mergedData.length - 1]?.[label];

    const start = typeof first === 'number' ? first : 0;
    const current = typeof last === 'number' ? last : 0;
    const delta = current - start;

    const labelMap: Record<string, string> = {
      '3d': 'last 3 days',
      '1w': 'last week',
      '2w': 'last 2 weeks',
      '1m': 'last month',
      all: 'all time',
    };

    return [current, delta, labelMap[timeRange] ?? ''];
  }, [mergedData, portfolioData, timeRange]);

  return {
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
    rangeLabel,
  };
}
