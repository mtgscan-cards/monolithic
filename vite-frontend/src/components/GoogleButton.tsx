// src/components/GoogleButton.tsx
import React, { useEffect, useContext } from 'react'
import api from '../api/axios'
import { useNavigate } from 'react-router-dom'
import { AuthContext, User } from '../contexts/AuthContext'

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
}

export const GoogleButton: React.FC<GoogleButtonProps> = ({
  text = 'signin_with',
  linkMode = false,
  onSuccess,
}) => {
  const navigate = useNavigate()
  const { setUser } = useContext(AuthContext)

  useEffect(() => {
    if (!window.google) return

    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID!,
      scope: 'openid email profile',
      callback: async ({ credential }) => {
        try {
          const { data } = await api.post(
            linkMode ? '/auth/link/google' : '/auth/login/google',
            { credential }
          )

          // store only the access token
          localStorage.setItem('access_token', data.access_token)
          api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`

          // update context
          setUser({
            display_name:  data.display_name,
            avatar_url:    data.avatar_url,
            google_linked: data.google_linked,
            github_linked: data.github_linked,
            has_password:  data.has_password,
            username:      data.username,
          } as User)

          // navigate
          if (!linkMode) navigate(data.has_password ? '/' : '/setup')
          else         navigate('/')

          onSuccess?.()
        } catch (err) {
          console.error('Google auth error', err)
        }
      },
    })

    window.google.accounts.id.renderButton(
      document.getElementById('gBtn')!,
      { theme: 'outline', size: 'large', text }
    )
  }, [linkMode, navigate, onSuccess, setUser, text])

  return <div id="gBtn" style={{ marginTop: 12 }} />
}
