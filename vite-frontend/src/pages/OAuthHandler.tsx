// src/pages/OAuthHandler.tsx
import React, { useEffect, useContext } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'
import api from '../api/axios'

const OAuthHandler: React.FC = () => {
  const { setUser } = useContext(AuthContext)
  const navigate = useNavigate()
  const { hash } = useLocation()

  useEffect(() => {
    const fragment = hash.startsWith('#') ? hash.slice(1) : ''
    const params = new URLSearchParams(fragment)
    const access_token = params.get('access_token')

    if (!access_token) {
      console.warn('[OAuthHandler] Missing token — redirecting to login')
      navigate('/login', { replace: true })
      return
    }

    const username      = params.get('username') || ''
    const avatar_url    = params.get('avatar_url') || ''
    const display_name  = params.get('display_name') || ''
    const google_linked = params.get('google_linked') === 'true'
    const github_linked = params.get('github_linked') === 'true'
    const has_password  = params.get('has_password') === 'true'

    localStorage.setItem('access_token', access_token)
    localStorage.setItem('username', username)
    localStorage.setItem('avatar_url', avatar_url)
    localStorage.setItem('display_name', display_name)
    localStorage.setItem('google_linked', String(google_linked))
    localStorage.setItem('github_linked', String(github_linked))
    localStorage.setItem('has_password', String(has_password))
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`

    setUser({
      username,
      avatar_url,
      display_name,
      google_linked,
      github_linked,
      has_password,
    })

    const target = has_password ? '/' : '/setup'
    navigate(target, { replace: true })
  }, [hash, navigate, setUser])

  return <p>Authenticating…</p>
}

export default OAuthHandler