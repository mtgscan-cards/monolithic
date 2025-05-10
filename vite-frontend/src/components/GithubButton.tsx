import React from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { Button } from '@mui/material'
import GitHubIcon from '@mui/icons-material/GitHub'
import { useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'

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
  const navigate = useNavigate()
  const { setUser } = useContext(AuthContext)

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
      try {
        const popup = window.open(`${apiUrl}/auth/login/github`, '_blank', 'width=500,height=600')
        if (!popup) return

        const poll = setInterval(async () => {
          try {
            const res = await axios.get(`${apiUrl}/auth/me`, { withCredentials: true })
            const user = res.data

            localStorage.setItem('access_token', user.access_token)
            localStorage.setItem('username', user.username)
            localStorage.setItem('avatar_url', user.avatar_url)
            localStorage.setItem('display_name', user.display_name)
            localStorage.setItem('google_linked', String(user.google_linked))
            localStorage.setItem('github_linked', String(user.github_linked))
            localStorage.setItem('has_password', String(user.has_password))
            axios.defaults.headers.common['Authorization'] = `Bearer ${user.access_token}`

            setUser(user)

            clearInterval(poll)
            popup.close()

            if (!user.has_password) navigate('/setup')
            else                    navigate('/')

            onSuccess?.()
          } catch {
            // keep polling
          }
        }, 1000)
      } catch (err) {
        console.error('GitHub login error', err)
      }
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
