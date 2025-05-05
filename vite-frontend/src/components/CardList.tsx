// src/components/CardList.tsx
import React, { useState, useEffect } from 'react'
import {
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Typography,
  Box,
  FormControlLabel,
  Switch,
  Divider,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material'
import { ScannedCard } from '../hooks/useFrameProcessor'
import {
  getCollections,
  createCollection,
  CollectionData,
  CreateCollectionPayload,
  bulkAddToCollection,
} from '../api/collections'

interface CardListProps {
  scannedCards: ScannedCard[]
  handleToggleFoil: (cardId: string) => void
  onCardAdded?: () => void
}

const CardList: React.FC<CardListProps> = ({
  scannedCards,
  handleToggleFoil,
  onCardAdded,
}) => {
  const [collections, setCollections] = useState<CollectionData[]>([])
  const [selectedCollection, setSelectedCollection] = useState<CollectionData | null>(null)
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({})
  const [errorMap] = useState<Record<string, string>>({})
  const [selectDialogOpen, setSelectDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => {
    getCollections()
      .then(cols => {
        setCollections(cols)
        if (cols.length === 1) {
          setSelectedCollection(cols[0])
        } else if (cols.length > 1) {
          setSelectDialogOpen(true)
        } else {
          setCreateDialogOpen(true)
        }
      })
      .catch(err => {
        console.error('Failed to fetch collections', err)
      })
  }, [])

  const handleBulkAdd = async () => {
    if (!selectedCollection || scannedCards.length === 0) return

    setBulkLoading(true)

    try {
      const bulkText = scannedCards
        .map(card => `${card.quantity} ${card.name} (${card.set}) ${card.collectorNumber}`)
        .join('\n')

      await bulkAddToCollection(
        selectedCollection.username || localStorage.getItem('username') || 'default',
        selectedCollection.user_collection_id,
        bulkText,
        'en'
      )

      const updatedMap: Record<string, boolean> = {}
      scannedCards.forEach(card => {
        updatedMap[card.id] = true
      })
      setAddedMap(updatedMap)
      onCardAdded?.()
    } catch (e) {
      console.error('Bulk add failed:', e)
    } finally {
      setBulkLoading(false)
    }
  }

  const handleSelectCollection = async (col: CollectionData) => {
    setSelectedCollection(col)
    setSelectDialogOpen(false)
  }

  const handleCreateCollection = async () => {
    if (!newListName.trim()) return

    const payload: CreateCollectionPayload = {
      label: newListName,
      cardStackStateIndex: 0,
      color: { top: 0xffffff, bottom: 0x8b4513 },
    }

    try {
      const newCol = await createCollection(payload)
      setCollections(prev => [...prev, newCol])
      setSelectedCollection(newCol)
      setCreateDialogOpen(false)
      setNewListName('')
    } catch (e) {
      console.error('Error creating collection', e)
    }
  }

  return (
    <Box mt={2}>
      <Divider sx={{ mb: 2 }} />
      {scannedCards.length === 0 ? (
        <Typography variant="body2" color="textSecondary">
          No cards scanned yet.
        </Typography>
      ) : (
        <>
          <List>
            {scannedCards.map(card => {
              const isAdded = addedMap[card.id]
              const error = errorMap[card.id]

              return (
                <ListItem key={card.id} sx={{ alignItems: 'flex-start' }}>
                  <ListItemAvatar>
                    <Box sx={{ position: 'relative', width: 80, height: 110, mr: 2 }}>
                      <Avatar
                        variant="rounded"
                        src={card.imageUri}
                        alt={card.name}
                        sx={{ width: '100%', height: '100%' }}
                      />
                      {card.foil && <div className="foil-realistic" />}
                    </Box>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`${card.quantity}× ${card.name}`}
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="textPrimary">
                          Set: {card.setName}
                        </Typography>
                        <br />
                        <Typography component="span" variant="body2" color="textSecondary">
                          Price: {card.foil ? card.prices.foil : card.prices.normal} USD
                        </Typography>
                        <br />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={card.foil}
                              onChange={() => handleToggleFoil(card.id)}
                              color="primary"
                              disabled={!card.hasFoil}
                            />
                          }
                          label="Foil"
                        />
                        <br />
                        {error && (
                          <Alert severity="warning" sx={{ mt: 1, mb: 1 }}>
                            {error}
                          </Alert>
                        )}
                        {isAdded && (
                          <Typography variant="body2" color="success.main">
                            ✓ Added
                          </Typography>
                        )}
                      </>
                    }
                  />
                </ListItem>
              )
            })}
          </List>

          <Box display="flex" justifyContent="center" mt={2}>
            <Button
              variant="contained"
              color="primary"
              disabled={
                !selectedCollection ||
                scannedCards.every(card => addedMap[card.id]) ||
                bulkLoading
              }
              onClick={handleBulkAdd}
            >
              {bulkLoading ? <CircularProgress size={18} /> : 'Add All to Collection'}
            </Button>
          </Box>
        </>
      )}

      <Dialog open={selectDialogOpen} onClose={() => setSelectDialogOpen(false)}>
        <DialogTitle>Select a Collection</DialogTitle>
        <DialogContent>
          {collections.map(col => (
            <Box key={col.user_collection_id} sx={{ my: 1 }}>
              <Button variant="outlined" fullWidth onClick={() => handleSelectCollection(col)}>
                {col.label}
              </Button>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)}>
        <DialogTitle>Create New Collection</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Collection Name"
            fullWidth
            value={newListName}
            onChange={e => setNewListName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateCollection}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default CardList