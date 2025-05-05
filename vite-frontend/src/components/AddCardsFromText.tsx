// src/components/AddCardsFromText.tsx
import React, { useState } from 'react'
import {
  Box, TextField, Button, Typography, Alert, CircularProgress
} from '@mui/material'
import { addCardsByText } from '../api/collections'

const AddCardsFromText: React.FC<{
  username: string
  user_collection_id: number
  onSuccess?: () => void
}> = ({ username, user_collection_id, onSuccess }) => {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      await addCardsByText(username, user_collection_id, text)
      setText('')
      onSuccess?.()
    } catch {
      setError('Failed to add cards. Please check formatting or try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ my: 3 }}>
      <Typography variant="h6">Add cards from text</Typography>
      <TextField
        multiline
        fullWidth
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Paste card list here:\n1 Akki Ronin (NEO) 319\n2 Kami of Industry (NEO) 149`}
        sx={{ mt: 1 }}
      />
      <Button onClick={handleSubmit} variant="contained" sx={{ mt: 2 }} disabled={loading}>
        {loading ? <CircularProgress size={20} /> : 'Add Cards'}
      </Button>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </Box>
  )
}

export default AddCardsFromText
