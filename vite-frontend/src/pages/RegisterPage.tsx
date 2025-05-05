// src/pages/RegisterPage.tsx

import React, { useState, useEffect, useRef, useContext, FormEvent } from 'react'
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  InputAdornment,
} from '@mui/material'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import { useNavigate } from 'react-router-dom'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import axios from 'axios'

import { register, login } from '../api/auth'
import api from '../api/axios'
import { AuthContext, User } from '../contexts/AuthContext'

const USERNAME_REGEX = /^[^/?#\s]{3,30}$/

const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const { setUser } = useContext(AuthContext)!
  const debounceRef = useRef<number | null>(null)

  const [username, setUsername]           = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername]   = useState(false)

  const [email, setEmail]           = useState('')
  const [emailError, setEmailError] = useState('')

  const [password, setPassword]         = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [error, setError]               = useState<string | null>(null)
  const [loading, setLoading]           = useState(false)

  // Debounce e-mail‐exists check
  useEffect(() => {
    if (!email) {
      setEmailError('')
      return
    }
    const id = window.setTimeout(async () => {
      try {
        const { data } = await axios.get<{ exists: boolean }>(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/auth/user_exists`,
          { params: { email }, withCredentials: true }
        )
        setEmailError(data.exists ? 'This email is already registered' : '')
      } catch {
        // ignore
      }
    }, 500)
    return () => window.clearTimeout(id)
  }, [email])

  // Debounce username‐format + availability check
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)

    const trimmed = username.trim()
    setUsernameError('')
    setUsernameAvailable(null)

    if (!trimmed) {
      setCheckingUsername(false)
      return
    }

    if (!USERNAME_REGEX.test(trimmed)) {
      setUsernameError('3–30 chars; no "/", "?", "#", or spaces')
      return
    }

    setCheckingUsername(true)
    debounceRef.current = window.setTimeout(async () => {
      try {
        const { data } = await api.get<{ available: boolean }>(
          '/auth/username_available',
          { params: { username: trimmed } }
        )
        if (data.available) {
          setUsernameError('')
          setUsernameAvailable(true)
        } else {
          setUsernameError('That username is taken')
          setUsernameAvailable(false)
        }
      } catch {
        setUsernameError('Could not verify availability')
        setUsernameAvailable(false)
      } finally {
        setCheckingUsername(false)
      }
    }, 400)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [username])

  const handleHCaptchaVerify = (token: string) => {
    setCaptchaToken(token)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedUsername = username.trim()
    if (!USERNAME_REGEX.test(trimmedUsername)) {
      setError('Invalid username format')
      return
    }
    if (usernameError || !usernameAvailable) {
      setError(usernameError || 'Username is not available')
      return
    }
    if (!email || emailError) {
      setError(emailError || 'Email is required')
      return
    }
    if (!password) {
      setError('Password is required')
      return
    }
    if (!captchaToken) {
      setError('Please complete the hCaptcha')
      return
    }

    setLoading(true)
    try {
      // 1) Native registration
      await register(email, password, captchaToken)

      // 2) Immediately log in
      const loginRes = await login(email, password, captchaToken)
      localStorage.setItem('access_token', loginRes.access_token)
      api.defaults.headers.common['Authorization'] = `Bearer ${loginRes.access_token}`

      const initialUser: User = {
        display_name:  loginRes.display_name,
        avatar_url:    loginRes.avatar_url,
        google_linked: loginRes.google_linked,
        github_linked: loginRes.github_linked,
        has_password:  loginRes.has_password,
        username:      loginRes.username,
      }
      setUser(initialUser)

      // 3) Set the final username
      const { data: nameData } = await api.post<{ access_token: string }>(
        '/auth/set_username',
        { username: trimmedUsername }
      )
      localStorage.setItem('access_token', nameData.access_token)
      api.defaults.headers.common['Authorization'] = `Bearer ${nameData.access_token}`

      setUser({ ...initialUser, username: trimmedUsername })
      navigate('/', { replace: true })

    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Registration failed')
      } else {
        setError('Registration failed')
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
          Register
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, width: '100%' }}>
          {/* Username */}
          <TextField
            label="Username"
            fullWidth
            required
            margin="normal"
            value={username}
            onChange={e => setUsername(e.target.value)}
            error={!!usernameError}
            helperText={usernameError || '3–30 chars; no "/", "?", "#", or spaces'}
            color={usernameAvailable ? 'success' : 'primary'}
            InputProps={{
              endAdornment: username ? (
                <InputAdornment position="end">
                  {checkingUsername
                    ? <CircularProgress size={16} />
                    : usernameError
                      ? <CloseIcon fontSize="small" />
                      : <CheckIcon fontSize="small" />
                  }
                </InputAdornment>
              ) : null,
            }}
          />

          {/* Email */}
          <TextField
            label="Email"
            fullWidth
            required
            margin="normal"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            error={!!emailError}
            helperText={emailError}
          />

          {/* Password */}
          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            margin="normal"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          {/* hCaptcha */}
          <Box sx={{ mt: 2, width: '100%' }}>
            <HCaptcha
              sitekey={import.meta.env.VITE_HCAPTCHA_SITEKEY || ''}
              onVerify={handleHCaptchaVerify}
              onExpire={() => setCaptchaToken('')}
            />
          </Box>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3 }}
            disabled={loading || checkingUsername}
          >
            {loading ? <CircularProgress size={24} /> : 'Register'}
          </Button>
        </Box>
      </Box>
    </Container>
  )
}

export default RegisterPage