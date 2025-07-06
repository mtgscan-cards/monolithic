// src/pages/LoginPage.tsx

import React, { useState, useEffect, useContext } from 'react'
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Link as MuiLink,
} from '@mui/material'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import axios from 'axios'
import api from '../../api/axios'
import { login, LoginResponse } from '../../api/auth'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import { GoogleButton } from '../../components/auth/GoogleButton'
import { GithubButton } from '../../components/auth/GithubButton'
import { AuthContext, User } from '../../contexts/AuthContext'

const LoginPage: React.FC = () => {
  const { user, setUser } = useContext(AuthContext)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorSeverity, setErrorSeverity] = useState<'error' | 'info'>('error')
  const [hcaptchaToken, setHcaptchaToken] = useState('')
  const [showCaptcha, setShowCaptcha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const next = params.get('next') || '/'

  // Prevent flash of login page if already authenticated
  useEffect(() => {
    if (user) {
      navigate(next, { replace: true })
    } else {
      setCheckingAuth(false)
    }
  }, [user, next, navigate])

  // Dynamically load GSI script only on LoginPage
  useEffect(() => {
    if (!document.getElementById('gsi-script')) {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.id = 'gsi-script'
      document.body.appendChild(script)
    }
  }, [])

  const handleHCaptchaVerify = (token: string) => {
    setHcaptchaToken(token)
    setError(null)
    setErrorSeverity('error')
    handleSubmit()
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError(null)
    setErrorSeverity('error')

    if (!hcaptchaToken && !showCaptcha) {
      setShowCaptcha(true)
      setError('Please complete the hCaptcha to continue.')
      setErrorSeverity('info')
      return
    }

    if (!hcaptchaToken) {
      setError('Please complete the hCaptcha to continue.')
      setErrorSeverity('info')
      return
    }

    setLoading(true)
    try {
      const data: LoginResponse = await login(email, password, hcaptchaToken)

      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('username', data.username)
      localStorage.setItem('avatar_url', data.avatar_url)
      api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`

      setUser({
        display_name: data.display_name,
        avatar_url: data.avatar_url,
        google_linked: data.google_linked,
        github_linked: data.github_linked,
        has_password: data.has_password,
        username: data.username,
      } as User)

      navigate(next, { replace: true })
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data?.message || 'Login failed')
      } else {
        setError('Login failed')
      }
      setErrorSeverity('error')
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Container maxWidth="xs">
      <Box
        sx={{
          mt: 8,
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: 3,
          borderRadius: 2,
          bgcolor: 'background.paper',
        }}
      >
        <Typography component="h1" variant="h5">
          Login
        </Typography>

        {/* OAuth buttons with ?next */}
        <GoogleButton text="signin_with" next={next} />
        <GithubButton text="Sign in with GitHub" next={next} />

        <Typography variant="caption" sx={{ mt: 1 }}>
          or with e-mail / password
        </Typography>

        {error && (
          <Alert severity={errorSeverity} sx={{ mt: 2, width: '100%' }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
          <TextField
            fullWidth
            required
            margin="normal"
            label="Email Address"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <TextField
            fullWidth
            required
            margin="normal"
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          {showCaptcha && (
            <Box sx={{ mt: 2 }}>
              <HCaptcha
                sitekey={import.meta.env.VITE_HCAPTCHA_SITEKEY || ''}
                onVerify={handleHCaptchaVerify}
              />
            </Box>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Login'}
          </Button>

          <Typography variant="body2" align="center" sx={{ mt: 2 }}>
            Don’t have an account?{' '}
            <MuiLink component={Link} to={`/register?next=${encodeURIComponent(next)}`} underline="hover">
              Register here
            </MuiLink>
          </Typography>
        </Box>
      </Box>
    </Container>
  )
}

export default LoginPage
