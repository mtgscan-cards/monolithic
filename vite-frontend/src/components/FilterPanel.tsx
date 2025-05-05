// src/components/FilterPanel.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { Box, Tabs, Tab, Button, Paper, Chip, Typography } from '@mui/material';
import KeywordFilter from './KeywordFilter';
import ColorFilter from './ColorFilter';
import TextFilter from './TextFilter';
import ManaCostFilter from './ManaCostFilter';
import { parseManaCost } from './utils/parseManaCost';

export type ManaOperator = '<' | '>' | '=' | 'between';

export interface ManaCostFilterValue {
  operator: ManaOperator;
  value: number | [number, number];
}

export interface FilterCriteria {
  keywords: string[];
  colors: string[];
  textFilters: string[];
  manaCost?: ManaCostFilterValue;
}

export interface FilterTag {
  type: 'keyword' | 'color' | 'text' | 'mana';
  value: string;
}

interface FilterPanelProps {
  onSearch: (criteria: FilterCriteria) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ onSearch }) => {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [textFilters, setTextFilters] = useState<string[]>([]);
  const [manaCost, setManaCost] = useState<ManaCostFilterValue | null>(null);
  const [tabValue, setTabValue] = useState<string>('keyword');

  const activeFilters = useMemo(() => {
    const filters: FilterTag[] = [
      ...selectedKeywords.map(k => ({ type: 'keyword' as const, value: k })),
      ...selectedColors.map(c => ({ type: 'color' as const, value: c })),
      ...textFilters.map(t => ({ type: 'text' as const, value: t })),
    ];
    if (manaCost) {
      let manaLabel = 'Mana: ';
      if (manaCost.operator === 'between') {
        const [min, max] = manaCost.value as [number, number];
        manaLabel += `between ${min}-${max}`;
      } else {
        manaLabel += `${manaCost.operator} ${manaCost.value}`;
      }
      filters.push({ type: 'mana', value: manaLabel });
    }
    return filters;
  }, [selectedKeywords, selectedColors, textFilters, manaCost]);

  useEffect(() => {
    console.log('Active filters:', activeFilters);
  }, [activeFilters]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: string) => {
    setTabValue(newValue);
  };

  const handleSearch = () => {
    const criteria: FilterCriteria = {
      keywords: selectedKeywords,
      colors: selectedColors,
      textFilters,
      manaCost: manaCost || undefined,
    };
    onSearch(criteria);
  };

  const handleRemoveFilter = (tag: FilterTag) => {
    if (tag.type === 'keyword') {
      setSelectedKeywords(prev => prev.filter(k => k !== tag.value));
    } else if (tag.type === 'color') {
      setSelectedColors(prev => prev.filter(c => c !== tag.value));
    } else if (tag.type === 'text') {
      setTextFilters(prev => prev.filter(t => t !== tag.value));
    } else if (tag.type === 'mana') {
      setManaCost(null);
    }
  };

  const renderTagContent = (tag: FilterTag) => {
    if (tag.type === 'color') {
      const parsed = parseManaCost(`{${tag.value}}`);
      return parsed.map((child, index) =>
        React.isValidElement(child)
          ? React.cloneElement(child, { key: `${tag.value}-${index}` })
          : child
      );
    }
    return tag.value;
  };

  return (
    <Paper sx={{ p: 3, mb: 4, backgroundColor: 'background.paper' }}>
      <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {activeFilters.map((tag, idx) => (
          <Chip
            key={`${tag.type}-${tag.value}-${idx}`}
            label={<Typography variant="body2">{renderTagContent(tag)}</Typography>}
            onDelete={() => handleRemoveFilter(tag)}
            color="secondary"
          />
        ))}
      </Box>
      <Tabs value={tabValue} onChange={handleTabChange} textColor="primary" indicatorColor="primary">
        <Tab label="Keywords" value="keyword" />
        <Tab label="Colors" value="color" />
        <Tab label="Text" value="text" />
        <Tab label="Mana" value="mana" />
      </Tabs>
      <Box sx={{ mt: 2 }}>
        {tabValue === 'keyword' && (
          <KeywordFilter selectedKeywords={selectedKeywords} onChange={setSelectedKeywords} />
        )}
        {tabValue === 'color' && (
          <ColorFilter selectedColors={selectedColors} onChange={setSelectedColors} />
        )}
        {tabValue === 'text' && (
          <TextFilter selectedTexts={textFilters} onAdd={(newText: string) => setTextFilters([...textFilters, newText])} />
        )}
        {tabValue === 'mana' && (
          <ManaCostFilter onAdd={(filter) => setManaCost(filter)} />
        )}
      </Box>
      <Box sx={{ mt: 3 }}>
        <Button variant="contained" fullWidth onClick={handleSearch}>
          Search
        </Button>
      </Box>
    </Paper>
  );
};

export default FilterPanel;