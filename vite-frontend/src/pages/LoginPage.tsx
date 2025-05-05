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
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import api from '../api/axios'
import { login, LoginResponse } from '../api/auth'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import { GoogleButton } from '../components/GoogleButton'
import { GithubButton } from '../components/GithubButton'
import { AuthContext, User } from '../contexts/AuthContext'

const LoginPage: React.FC = () => {
  const { setUser } = useContext(AuthContext)
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [error, setError]             = useState<string | null>(null)
  const [hcaptchaToken, setHcaptchaToken] = useState('')
  const [showCaptcha, setShowCaptcha] = useState(true)
  const [captchaVerified, setCaptchaVerified] = useState(false)
  const [loading, setLoading]         = useState(false)
  const navigate                       = useNavigate()

  // Determine if hCaptcha is required
  useEffect(() => {
    api.get('/auth/captcha_status')
       .then(res => {
         setShowCaptcha(!res.data.captcha_verified)
         setCaptchaVerified(res.data.captcha_verified)
       })
       .catch(() => {
         setShowCaptcha(true)
         setCaptchaVerified(false)
       })
  }, [])

  const handleHCaptchaVerify = async (token: string) => {
    try {
      await api.post('/auth/verify_captcha', { token })
      setHcaptchaToken(token)
      setCaptchaVerified(true)
      setShowCaptcha(false)
    } catch {
      setError('Unable to verify hCaptcha. Please try again.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!captchaVerified && !hcaptchaToken) {
      setError('Please complete the hCaptcha challenge.')
      setLoading(false)
      return
    }

    try {
      const data: LoginResponse = await login(email, password, hcaptchaToken)

      // persist token + username
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('username',      data.username)
      localStorage.setItem('avatar_url',    data.avatar_url)
      api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`

      // seed context
      setUser({
        display_name:  data.display_name,
        avatar_url:    data.avatar_url,
        google_linked: data.google_linked,
        github_linked: data.github_linked,
        has_password:  data.has_password,
        username:      data.username,
      } as User)

      navigate('/')
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data?.message || 'Login failed')
      } else {
        setError('Login failed')
      }
    } finally {
      setLoading(false)
    }
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

        {/* OAuth buttons */}
        <GoogleButton text="signin_with" />
        <GithubButton text="Sign in with GitHub" />

        <Typography variant="caption" sx={{ mt: 1 }}>
          or with e-mail / password
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
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
            <MuiLink component={Link} to="/register" underline="hover">
              Register here
            </MuiLink>
          </Typography>
        </Box>
      </Box>
    </Container>
  )
}

export default LoginPage