import React, { useEffect, useContext } from 'react'
import api from '../api/axios'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../contexts/AuthContext'

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

          const {
            access_token,
            username,
            display_name,
            avatar_url,
            google_linked,
            github_linked,
            has_password,
          } = data

          // store locally
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
            if (!has_password) navigate('/setup')
            else               navigate('/')
          }

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