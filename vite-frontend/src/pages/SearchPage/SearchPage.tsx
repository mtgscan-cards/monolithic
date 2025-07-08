// src/pages/SearchPage/SearchPage.tsx

import React, { useState, Suspense } from 'react';
import { Box } from '@mui/material';

const FilterPanel = React.lazy(() => import('../../components/filters/FilterPanel'));
import type { FilterCriteria } from '../../components/filters/FilterPanel';

const SearchResults = React.lazy(() => import('../../components/filters/SearchResults'));
import type { Card } from '../../components/filters/SearchResults';

import { sendFilterCriteria } from '../../api/FilterBackend';

import 'keyrune/css/keyrune.css';
import '../../styles/App.css';
import '../../styles/SearchResults.css';

interface FilterRequest extends FilterCriteria {
  limit: number;
  lastId?: string;
}

const SearchPage: React.FC = () => {
  const [results, setResults] = useState<Card[]>([]);
  const [currentCriteria, setCurrentCriteria] = useState<FilterCriteria | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const runNewSearch = async (criteria: FilterCriteria) => {
    setCurrentCriteria(criteria);
    try {
      const requestData: FilterRequest = {
        ...criteria,
        limit: 18,
      };
      const { results: newResults } = await sendFilterCriteria(requestData);
      setResults(newResults);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const loadMore = async () => {
    if (!currentCriteria || results.length === 0) return;
    const lastCard = results[results.length - 1];
    setLoadingMore(true);
    try {
      const requestData: FilterRequest = {
        ...currentCriteria,
        limit: 18,
        lastId: lastCard.id,
      };
      const { results: more } = await sendFilterCriteria(requestData);
      setResults(prev => [...prev, ...more]);
    } catch (err) {
      console.error('Load more failed:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: { xs: 2, sm: 4 },
        width: '100%',
      }}
    >
      <Box sx={{ mb: 4, mt: 4, width: '100%', maxWidth: 900 }}>
        <Suspense fallback={null}>
          <FilterPanel onSearch={runNewSearch} />
        </Suspense>
      </Box>
      <Box sx={{ width: '100%', maxWidth: 1200 }}>
        <Suspense fallback={null}>
          <SearchResults
            results={results}
            onLoadMore={loadMore}
            loadingMore={loadingMore}
            totalResults={0}
          />
        </Suspense>
      </Box>
    </Box>
  );
};

export default SearchPage;
