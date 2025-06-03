import React, { useState, useRef } from 'react'
import {
  Box,
  Typography,
  TextField,
  Button,
  Collapse,
  Paper,
  Stack,
  Tooltip,
  IconButton,
  Alert,
  ClickAwayListener,
} from '@mui/material'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { bulkAddToCollection } from '../api/collections'

interface BulkCardAdderProps {
  username: string
  collectionId: number
  onComplete: () => void
}

const BulkCardAdder: React.FC<BulkCardAdderProps> = ({ username, collectionId, onComplete }) => {
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Tooltip state
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const tooltipTimeout = useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (tooltipTimeout.current) {
        clearTimeout(tooltipTimeout.current)
      }
    }
  }, [])
  const handleTooltipToggle = () => {
    setTooltipOpen(true)
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current)
    tooltipTimeout.current = setTimeout(() => setTooltipOpen(false), 4000)
  }

  const handleTooltipClose = () => {
    setTooltipOpen(false)
  }

  const handleSubmit = async () => {
    if (!text.trim()) return
    try {
      const { added, failed } = await bulkAddToCollection(username, collectionId, text)
      if (added > 0) {
        setMessage(`✅ Added ${added} card(s).`)
        setError(null)
      }
      if (failed > 0) {
        setError(`❌ Failed to add ${failed} card(s).`)
      }
      onComplete()
    } catch {
      setMessage(null)
      setError('❌ Error occurred while adding cards.')
    }
  }

  const handleClear = () => {
    setText('')
    setMessage(null)
    setError(null)
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Button
        variant="outlined"
        onClick={() => setExpanded(prev => !prev)}
        endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ mb: 2 }}
      >
        {expanded ? 'Hide Bulk Adder' : 'Bulk Add Cards'}
      </Button>

      <Collapse in={expanded}>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6">Add Cards via MTG Text Format</Typography>

            <ClickAwayListener onClickAway={handleTooltipClose}>
              <Tooltip
                title="Used to automatically add multiple cards at once using MTG text format."
                open={tooltipOpen}
                onOpen={() => setTooltipOpen(true)}
                onClose={handleTooltipClose}
                disableFocusListener
                disableHoverListener
                disableTouchListener
              >
                <IconButton size="small" sx={{ ml: 1 }} onClick={handleTooltipToggle}>
                  <HelpOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </ClickAwayListener>
          </Box>

          <TextField
            multiline
            fullWidth
            minRows={6}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`3 Lightning Bolt (LEA) 116\n2 Counterspell (8ED) 92\n1 Black Lotus (LEA) 233`}
          />

          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={!text.trim()}
            >
              Add Cards
            </Button>
            <Button onClick={handleClear} variant="text">
              Clear
            </Button>
          </Stack>

          {message && (
            <Alert sx={{ mt: 2 }} severity="success">
              {message}
            </Alert>
          )}
          {error && (
            <Alert sx={{ mt: 2 }} severity="error">
              {error}
            </Alert>
          )}
        </Paper>
      </Collapse>
    </Box>
  )
}

export default BulkCardAdder