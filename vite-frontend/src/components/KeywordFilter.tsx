// src/components/KeywordFilter.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Button,
  CircularProgress,
} from '@mui/material';

interface Tag {
  keyword: string;
  count: number;
}

interface KeywordFilterProps {
  selectedKeywords?: string[]; // optional prop
  onChange: (selectedKeywords: string[]) => void;
}

const computeInitialTagCount = () => {
  const width = window.innerWidth;
  if (width > 1200) return 20;
  if (width > 800) return 15;
  return 10;
};

// Frontend cache for tag results
let cachedTags: Tag[] | null = null;

const KeywordFilter: React.FC<KeywordFilterProps> = ({ selectedKeywords = [], onChange }) => {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [visibleTagCount, setVisibleTagCount] = useState<number>(computeInitialTagCount());
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch available tags on mount.
  useEffect(() => {
    const fetchTags = async () => {
      if (cachedTags) {
        setAvailableTags(cachedTags);
        setLoading(false);
      } else {
        try {
          const response = await axios.get('http://localhost:5000/api/tags');
          const tags: Tag[] = Array.isArray(response.data.tags) ? response.data.tags : [];
          cachedTags = tags;
          setAvailableTags(tags);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching tags:', error);
          setLoading(false);
        }
      }
    };
    fetchTags();
  }, []);

  // Update visible tag count on window resize.
  useEffect(() => {
    const handleResize = () => {
      setVisibleTagCount(computeInitialTagCount());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleKeyword = (keyword: string) => {
    if (selectedKeywords.includes(keyword)) {
      onChange(selectedKeywords.filter((k) => k !== keyword));
    } else {
      onChange([...selectedKeywords, keyword]);
    }
  };

  // Filter out tags that have already been selected.
  const filteredTags = availableTags.filter((tag) => !selectedKeywords.includes(tag.keyword));
  const visibleTags = filteredTags.slice(0, visibleTagCount);

  if (loading) {
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Keywords
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress color="secondary" />
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Keywords
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {visibleTags.map((tag) => (
          <Chip
            key={tag.keyword}
            label={`${tag.keyword} (${tag.count})`}
            onClick={() => toggleKeyword(tag.keyword)}
            color="secondary"
            sx={{ cursor: 'pointer' }}
          />
        ))}
        {filteredTags.length > visibleTagCount && (
          <Button variant="outlined" onClick={() => setVisibleTagCount(visibleTagCount + 5)}>
            Show More
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export default KeywordFilter;