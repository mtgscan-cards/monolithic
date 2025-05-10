// src/components/GithubButton.tsx
import React from 'react'
import axios from 'axios'
import { Button } from '@mui/material'
import GitHubIcon from '@mui/icons-material/GitHub'

interface GithubButtonProps {
  text?: string
  linkMode?: boolean
  onSuccess?: () => void
}

export const GithubButton: React.FC<GithubButtonProps> = ({
  text = 'Sign in with GitHub',
  linkMode = false,
  onSuccess,
}) => {
  const apiUrl = import.meta.env.VITE_API_URL || 'https://api.mtgscan.cards'

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
      // ✅ Full-page redirect avoids CORS and ensures session cookies are handled
      window.location.href = `${apiUrl}/auth/login/github`
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
