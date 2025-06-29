// src/components/GithubButton.tsx

import React from 'react'
import axios from 'axios'
import { Button } from '@mui/material'
import GitHubIcon from '@mui/icons-material/GitHub'
import { useLocation } from 'react-router-dom'

interface GithubButtonProps {
  text?: string
  linkMode?: boolean
  onSuccess?: () => void
  next?: string
}

export const GithubButton: React.FC<GithubButtonProps> = ({
  text = 'Sign in with GitHub',
  linkMode = false,
  onSuccess,
  next,
}) => {
  const apiUrl = import.meta.env.VITE_API_URL || 'https://api.mtgscan.cards'
  const location = useLocation()

  // Determine next route from prop or ?next param
  const params = new URLSearchParams(location.search)
  const nextPath = next || params.get('next') || '/'

  const handleClick = async () => {
    if (linkMode) {
      try {
        const token = localStorage.getItem('access_token') || ''
        const { data } = await axios.post(
          `${apiUrl}/auth/link/github`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
            withCredentials: true,
          }
        )
        window.location.href = data.auth_url
        onSuccess?.()
      } catch (err) {
        console.error('Failed to start GitHub link flow', err)
      }
    } else {
      // Full-page redirect with ?next for post-login redirection
      const redirectUrl = `${apiUrl}/auth/login/github?next=${encodeURIComponent(nextPath)}`
      window.location.href = redirectUrl
    }
  }

  return (
    <Button
      fullWidth
      variant="contained"
      startIcon={<GitHubIcon />}
      onClick={handleClick}
      sx={{
        mt: 2,
        textTransform: 'none',
        fontWeight: 500,
        backgroundColor: '#24292e',
        color: '#fff',
        width: '177px',
        height: '40px',
        '&:hover': { backgroundColor: '#1b1f23' },
      }}
    >
      {text}
    </Button>
  )
}