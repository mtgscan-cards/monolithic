// src/pages/CollectionDetails.tsx
import React, { useEffect, useState, useRef, useContext, useCallback } from 'react'
import { useParams, Link as RouterLink } from 'react-router-dom'
import {
  Container,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Paper,
  IconButton,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import { isAxiosError } from 'axios'

import {
  getCollection,
  getCollectionCards,
  deleteCollectionCard,
  CollectionData,
  CardData,
} from '../api/collections'
import CollectionValue from '../components/CollectionValue'
import SetSymbol from '../components/utils/SetSymbol'
import BulkCardAdder from '../components/BulkCardAdder'
import { AuthContext } from '../contexts/AuthContext'
import ToggleableImage from '../components/ToggleableImage'

const CollectionDetails: React.FC = () => {
  const { user } = useContext(AuthContext)
  const params = useParams<{ username?: string; user_collection_id?: string }>()

  const routeUsername = params.username ?? ''
  const collId = parseInt(params.user_collection_id ?? '', 10)

  const [collection, setCollection] = useState<CollectionData | null>(null)
  const [cards, setCards]           = useState<CardData[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [refreshCounter, setRefreshCounter] = useState(0)

  const hasFetchedRef = useRef(false)
  const isOwner = Boolean(user && user.username === routeUsername)

  const refreshValue = () => setRefreshCounter(prev => prev + 1)

  const fetchCards = useCallback(async () => {
    const cardsData = await getCollectionCards(routeUsername, collId)
    setCards(cardsData)
  }, [routeUsername, collId])

  useEffect(() => {
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true

    if (!routeUsername || isNaN(collId)) {
      setError('Invalid collection URL')
      setLoading(false)
      return
    }

    setLoading(true)
    ;(async () => {
      try {
        const collData = await getCollection(routeUsername, collId)
        setCollection(collData)

        const canViewCards = collData.is_public || isOwner
        if (canViewCards) {
          await fetchCards()
        }
      } catch (err: unknown) {
        if (isAxiosError(err)) {
          const status = err.response?.status
          if (status === 404)      setError('Collection not found.')
          else if (status === 401) setError('This collection is private.')
          else                     setError('Failed to load collection details.')
        } else {
          setError('Failed to load collection details.')
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [routeUsername, collId, user, isOwner, fetchCards])

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Container>
    )
  }

  if (error) {
    if (error === 'This collection is private.') {
      return (
        <Container sx={{ mt: 4, textAlign: 'center' }}>
          <Alert severity="warning">{error}</Alert>
          <Button
            component={RouterLink}
            to="/login"
            variant="contained"
            sx={{ mt: 2 }}
          >
            Log In
          </Button>
        </Container>
      )
    }
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    )
  }

  const coll = collection!

  return (
    <Container sx={{ mt: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {coll.label}
        </Typography>
        <Typography>Card Stack State: {coll.cardStackStateIndex}</Typography>

        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 20,
                height: 20,
                bgcolor: `#${coll.color.top.toString(16).padStart(6, '0')}`,
                borderRadius: '50%',
              }}
            />
            <Typography variant="body2">Top Color</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 20,
                height: 20,
                bgcolor: `#${coll.color.bottom.toString(16).padStart(6, '0')}`,
                borderRadius: '50%',
              }}
            />
            <Typography variant="body2">Bottom Color</Typography>
          </Box>
        </Box>

        <Box sx={{ mt: 2 }}>
          <CollectionValue collectionId={coll.global_id} refreshSignal={refreshCounter} />
        </Box>
      </Box>

      {isOwner && (
        <BulkCardAdder
          username={routeUsername}
          collectionId={collId}
          onComplete={async () => {
            await fetchCards()
            refreshValue()
          }}
        />
      )}

      <Box>
        <Typography variant="h5" gutterBottom>
          Cards in Collection
        </Typography>
        {cards.length === 0 ? (
          <Typography>No cards in this collection.</Typography>
        ) : (
          <Grid container spacing={3}>
            {cards.map(card => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={card.id} sx={{ display: 'flex' }}>
                <Paper
                  elevation={3}
                  sx={{
                    p: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    flexGrow: 1,
                    width: '100%',
                  }}
                >
                  <ToggleableImage imageData={card.image_uris} altText={card.name || String(card.card_id)} />

                  <Box sx={{ mt: 1, flexGrow: 1 }}>
                    <Typography variant="h6">
                      {card.name || card.card_id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Added: {new Date(card.added_at).toLocaleString()}
                    </Typography>

                    {card.set && (
                      <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SetSymbol setCode={card.set} />
                        {card.set_name && <Typography>{card.set_name}</Typography>}
                      </Box>
                    )}
                  </Box>

                  {isOwner && (
                    <Box sx={{ textAlign: 'right' }}>
                      <IconButton
                        size="small"
                        onClick={async () => {
                          await deleteCollectionCard(routeUsername, collId, card.id)
                          setCards(cards.filter(c => c.id !== card.id))
                          refreshValue()
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Container>
  )
}

export default CollectionDetails