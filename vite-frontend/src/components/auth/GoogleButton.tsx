// src/components/auth/GoogleButton.tsx

import React, { useEffect, useContext, useRef } from 'react'
import api from '../../api/axios'
import { useNavigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../../contexts/AuthContext'

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            scope?: string
          }) => void
          renderButton: (
            el: HTMLElement,
            opts: { theme: string; size: string; text: string }
          ) => void
        }
      }
    }
  }
}

interface GoogleButtonProps {
  text?: 'signin_with' | 'signup_with' | 'continue_with'
  linkMode?: boolean
  onSuccess?: () => void
  next?: string
}

export const GoogleButton: React.FC<GoogleButtonProps> = ({
  text = 'signin_with',
  linkMode = false,
  onSuccess,
  next,
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useContext(AuthContext)
  const gBtnRef = useRef<HTMLDivElement>(null)

  const params = new URLSearchParams(location.search)
  const nextPath = next || params.get('next') || '/'

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    const tryRenderButton = () => {
      if (!window.google || !gBtnRef.current) return

      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID!,
        scope: 'openid email profile',
        callback: async ({ credential }) => {
          try {
            delete api.defaults.headers.common['Authorization']
            const { data } = await api.post(
              linkMode ? '/auth/link/google' : '/auth/login/google',
              { credential },
              { withCredentials: true }
            )

            const {
              access_token,
              username,
              display_name,
              avatar_url,
              google_linked,
              github_linked,
              has_password,
            } = data

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
              display_name,
              avatar_url,
              google_linked,
              github_linked,
              has_password,
            })

            if (!linkMode) {
              if (!has_password) {
                navigate('/setup')
              } else {
                navigate(nextPath, { replace: true })
              }
            }

            onSuccess?.()
          } catch (err) {
            console.error('Google auth error', err)
          }
        },
      })

      window.google.accounts.id.renderButton(
        gBtnRef.current!,
        { theme: 'outline', size: 'large', text }
      )

      if (interval) clearInterval(interval)
    }

    // Retry every 100ms until available
    interval = setInterval(tryRenderButton, 100)

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [linkMode, navigate, nextPath, onSuccess, setUser, text])

  return <div id="gBtn" ref={gBtnRef} style={{ marginTop: 12 }} />
}
