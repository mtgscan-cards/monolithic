import React from 'react';
import {
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    OutlinedInput
} from '@mui/material';
import { CollectionData } from '../../api/collections';

interface Props {
    collections: CollectionData[];
    selectedCollectionId: number | null;
    setSelectedCollectionId: (id: number) => void;
}

const CollectionSelector: React.FC<Props> = ({
    collections,
    selectedCollectionId,
    setSelectedCollectionId
}) => (
    <FormControl sx={{ mt: 2, minWidth: 300, backgroundColor: '#333', borderRadius: 1 }}>
        <InputLabel id="collection-select-label" sx={{ color: '#fff' }}>
            Select Collection
        </InputLabel>
        <Select
            labelId="collection-select-label"
            value={selectedCollectionId ?? ''}
            onChange={(e) => setSelectedCollectionId(Number(e.target.value))}
            input={<OutlinedInput label="Select Collection" sx={{ color: '#fff' }} />}
            sx={{
                '.MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#36A2EB' },
                color: '#fff'
            }}
            disabled={collections.length === 0}
        >
            {collections.map(coll => (
                <MenuItem key={coll.user_collection_id} value={coll.user_collection_id}>
                    {coll.label}
                </MenuItem>
            ))}
        </Select>
    </FormControl>
);

export default CollectionSelector;
