// src/pages/AccountSetupPage.tsx

import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  FormEvent,
} from 'react'
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
import api from '../api/axios'
import { AuthContext } from '../contexts/AuthContext'

const USERNAME_REGEX = /^[^/?#\s]{3,30}$/

const AccountSetupPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, setUser } = useContext(AuthContext)!
  const debounceRef = useRef<number | null>(null)

  // 1) On first render: grab access_token & temp-username from URL and persist
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const access = params.get('access_token')
    const tempUser = params.get('username')

    if (!access || !tempUser) {
      navigate('/login', { replace: true })
      return
    }

    localStorage.setItem('access_token', access)
    api.defaults.headers.common['Authorization'] = `Bearer ${access}`
    setUser({ ...user!, username: tempUser })

    window.history.replaceState({}, '', window.location.pathname)
  }, [navigate, setUser, user])

  // ──────────── Local form state ────────────────────────────────────
  const [username, setUsername]               = useState(user?.username || '')
  const [nameError, setNameError]             = useState<string>('')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checking, setChecking]               = useState(false)
  const [password, setPassword]               = useState('')
  const [captchaToken, setCaptchaToken]       = useState('')
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState<string | null>(null)

  // ── username availability & format debounce ──────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = username.trim()
    setNameError('')
    setUsernameAvailable(null)

    if (!trimmed) {
      setChecking(false)
      return
    }

    // Enforce format first
    if (!USERNAME_REGEX.test(trimmed)) {
      setNameError(
        'Must be 3–30 characters, and cannot include "/", "?", "#", or spaces'
      )
      return
    }

    // Fire availability check
    setChecking(true)
    debounceRef.current = window.setTimeout(async () => {
      try {
        const resp = await api.get<{ available: boolean }>(
          '/auth/username_available',
          { params: { username: trimmed } }
        )
        if (resp.data.available) {
          setUsernameAvailable(true)
          setNameError('')
        } else {
          setUsernameAvailable(false)
          setNameError('That username is taken')
        }
      } catch {
        setUsernameAvailable(false)
        setNameError('Could not verify availability')
      } finally {
        setChecking(false)
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [username])

  // ── submit handler ─────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmed = username.trim()
    if (!USERNAME_REGEX.test(trimmed)) {
      setError('Invalid username format')
      return
    }
    if (nameError || !usernameAvailable) {
      setError(nameError || 'Username is not available')
      return
    }
    if (!captchaToken) {
      setError('Please complete the hCaptcha')
      return
    }

    setLoading(true)
    try {
      // 1) Set username on backend
      const { data: setName } = await api.post<{ access_token: string }>(
        '/auth/set_username',
        { username: trimmed }
      )
      localStorage.setItem('access_token', setName.access_token)
      api.defaults.headers.common['Authorization'] = `Bearer ${setName.access_token}`
      setUser({ ...user!, username: trimmed })

      // 2) Then set password
      const { data: pwData } = await api.post<{ access_token: string }>(
        '/auth/set_password',
        { new_password: password, hcaptcha_token: captchaToken }
      )
      localStorage.setItem('access_token', pwData.access_token)
      api.defaults.headers.common['Authorization'] = `Bearer ${pwData.access_token}`

      // 3) Finally enter the app
      navigate('/', { replace: true })
    } catch {
      setError('Setup failed – please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, p: 4, boxShadow: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
        <Typography variant="h5" gutterBottom>
          Finish securing your account
        </Typography>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <TextField
            label="Username"
            fullWidth
            required
            margin="normal"
            value={username}
            onChange={e => setUsername(e.target.value)}
            error={!!nameError}
            helperText={nameError || ' '}
            color={usernameAvailable ? 'success' : 'primary'}  // ← green when available
            InputProps={{
              endAdornment: username ? (
                <InputAdornment position="end">
                  {checking
                    ? <CircularProgress size={16} />
                    : nameError
                      ? <CloseIcon fontSize="small" />
                      : <CheckIcon fontSize="small" />
                  }
                </InputAdornment>
              ) : null,
            }}
          />

          <TextField
            label="New password"
            type="password"
            fullWidth
            required
            margin="normal"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          {!captchaToken && (
            <Box sx={{ mt: 2 }}>
              <HCaptcha
                sitekey={import.meta.env.VITE_HCAPTCHA_SITEKEY || ''}
                onVerify={setCaptchaToken}
              />
            </Box>
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{ mt: 3 }}
            disabled={loading || checking}
          >
            {loading ? <CircularProgress size={24} /> : 'Save & continue'}
          </Button>
        </form>
      </Box>
    </Container>
  )
}

export default AccountSetupPage
