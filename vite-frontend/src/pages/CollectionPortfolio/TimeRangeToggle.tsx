import React from 'react';
import { Box, ToggleButtonGroup, ToggleButton } from '@mui/material';

interface Props {
    timeRange: string;
    setTimeRange: (value: string) => void;
}

const TimeRangeToggle: React.FC<Props> = ({ timeRange, setTimeRange }) => (
    <Box sx={{ mt: 2 }}>
        <ToggleButtonGroup
            value={timeRange}
            exclusive
            onChange={(_, val) => val && setTimeRange(val)}
            sx={{ backgroundColor: '#333', borderRadius: 1 }}
        >
            <ToggleButton value="3d">3d</ToggleButton>
            <ToggleButton value="1w">1W</ToggleButton>
            <ToggleButton value="2w">2W</ToggleButton>
            <ToggleButton value="1m">1M</ToggleButton>
            <ToggleButton value="all">All</ToggleButton>
        </ToggleButtonGroup>
    </Box>
);

export default TimeRangeToggle;
