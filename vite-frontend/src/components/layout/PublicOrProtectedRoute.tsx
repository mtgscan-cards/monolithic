// src/components/PublicOrProtectedRoute.tsx
import React, { useContext, useEffect, useState } from 'react'
import { Box, CircularProgress, Typography, Button } from '@mui/material'
import { Link, Outlet, useParams } from 'react-router-dom'
import api from '../../api/axios'
import { AuthContext } from '../../contexts/AuthContext'

const PublicOrProtectedRoute: React.FC = () => {
  const { user } = useContext(AuthContext)

  // Pull the raw params and then cast to our expected shape
  const { username, user_collection_id } =
    useParams() as { username?: string; user_collection_id?: string }

  const [loading, setLoading]   = useState(true)
  const [isPublic, setIsPublic] = useState(false)

  useEffect(() => {
    // If either param is missing, bail out
    if (!username || !user_collection_id) {
      setIsPublic(false)
      setLoading(false)
      return
    }

    setLoading(true)
    api
      .get<{ is_public: boolean }>(
        `/collections/${encodeURIComponent(username)}/collection/${encodeURIComponent(user_collection_id)}`,
        { skipRefreshOn401: true }  // ensure no forced refresh/redirection
      )
      .then(res => {
        setIsPublic(res.data.is_public)
      })
      .catch(() => {
        setIsPublic(false)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [username, user_collection_id])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  // If public, or if the signed-in user owns it, render child routes
  if (isPublic || (user && username === user.username)) {
    return <Outlet />
  }

  // Otherwise show a friendly private-content message
  return (
    <Box sx={{ textAlign: 'center', mt: 8 }}>
      <Typography variant="h6" gutterBottom>
        This collection is set to private by the owner.
      </Typography>

      {user ? (
        <Typography color="text.secondary">
          You don’t have permission to view this.
        </Typography>
      ) : (
        <>
          <Typography color="text.secondary" gutterBottom>
            Please request access or log in as the owner to view it.
          </Typography>
          <Button component={Link} to="/login" variant="contained" sx={{ mt: 2 }}>
            Log in
          </Button>
        </>
      )}
    </Box>
  )
}

export default PublicOrProtectedRoute