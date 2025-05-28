// src/components/CollectionValue.tsx
import React, { useEffect, useState } from 'react'
import { Typography, CircularProgress, Alert, Box } from '@mui/material'
import { getCurrentCollectionValue } from '../api/price'

interface CollectionValueProps {
  collectionId: number
  refreshSignal: number // force re-fetch
}

const CollectionValue: React.FC<CollectionValueProps> = ({ collectionId, refreshSignal }) => {
  const [currentValue, setCurrentValue] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchValue = async () => {
      setLoading(true)
      setError(null)

      try {
        const data = await getCurrentCollectionValue(collectionId)
        setCurrentValue(data.current_total_value)
      } catch {
        setError('Failed to load collection value')
      } finally {
        setLoading(false)
      }
    }

    fetchValue()
  }, [collectionId, refreshSignal]) // Refetch when signal changes

  if (loading) return <CircularProgress size={24} />
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6">
        Collection Value (USD): ${parseFloat(currentValue || '0').toFixed(2)}
      </Typography>
    </Box>
  )
}

export default CollectionValue