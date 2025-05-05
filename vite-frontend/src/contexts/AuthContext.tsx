// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react'
import { useNavigate, useLocation, matchPath } from 'react-router-dom'
import api from '../api/axios'

export interface User {
  display_name:  string
  avatar_url:    string
  google_linked: boolean
  github_linked: boolean
  has_password:  boolean
  username:      string
}

interface AuthContextValue {
  user: User | null
  setUser: (u: User | null) => void
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  setUser: () => {},
})

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const cachedUser: User | null = (() => {
    const access_token  = localStorage.getItem('access_token')
    const username      = localStorage.getItem('username')
    const avatar_url    = localStorage.getItem('avatar_url')
    const display_name  = localStorage.getItem('display_name')
    const google_linked = localStorage.getItem('google_linked') === 'true'
    const github_linked = localStorage.getItem('github_linked') === 'true'
    const has_password  = localStorage.getItem('has_password') === 'true'

    if (access_token && username && avatar_url && display_name) {
      return {
        username,
        avatar_url,
        display_name,
        google_linked,
        github_linked,
        has_password,
      }
    }
    return null
  })()

  const [user, setUser] = useState<User | null>(cachedUser)
  const navigate = useNavigate()
  const { search, hash, pathname } = useLocation()
  const hasFiredRef = useRef(false)

  useEffect(() => {
    if (hasFiredRef.current) return
    hasFiredRef.current = true

    console.log('[AuthContext] effect firing for path:', pathname)

    // 1) Handle OAuth /login callback
    const qs = (search.startsWith('?') ? search.slice(1) : '') ||
               (hash   .startsWith('#') ? hash  .slice(1) : '')
    if (qs) {
      const params = new URLSearchParams(qs)
      const at     = params.get('access_token')
      if (at) {
        const username      = params.get('username') || ''
        const avatar_url    = params.get('avatar_url') || ''
        const display_name  = params.get('display_name') || ''
        const google_linked = params.get('google_linked') === 'true'
        const github_linked = params.get('github_linked') === 'true'
        const has_password  = params.get('has_password') === 'true'

        localStorage.setItem('access_token', at)
        localStorage.setItem('username', username)
        localStorage.setItem('avatar_url', avatar_url)
        localStorage.setItem('display_name', display_name)
        localStorage.setItem('google_linked', String(google_linked))
        localStorage.setItem('github_linked', String(github_linked))
        localStorage.setItem('has_password', String(has_password))

        api.defaults.headers.common['Authorization'] = `Bearer ${at}`

        const u: User = {
          display_name,
          avatar_url,
          google_linked,
          github_linked,
          has_password,
          username,
        }

        setUser(u)

        if (!u.has_password) navigate('/setup', { replace: true })
        else                 navigate('/',       { replace: true })

        window.history.replaceState(null, document.title, pathname)
        return
      }
    }

    // 2) If there's a stored token, refresh via /auth/me
    const stored = localStorage.getItem('access_token')
    console.log('[AuthContext] stored access_token =', stored)
    if (stored) {
      api.defaults.headers.common['Authorization'] = `Bearer ${stored}`
      api.get<User>('/auth/me')
        .then(res => {
          console.log('[AuthContext] /auth/me succeeded:', res.data)

          localStorage.setItem('username',       res.data.username)
          localStorage.setItem('avatar_url',     res.data.avatar_url)
          localStorage.setItem('display_name',   res.data.display_name)
          localStorage.setItem('google_linked',  String(res.data.google_linked))
          localStorage.setItem('github_linked',  String(res.data.github_linked))
          localStorage.setItem('has_password',   String(res.data.has_password))

          setUser(res.data)
        })
        .catch(err => {
          console.warn('[AuthContext] /auth/me failed:', err)
        })
    }

    // 3) Decide whether to auto-redirect to /login
    const hasToken = !!stored
    const isPublicCollectionRoute = !!matchPath(
      { path: '/:username/collection/:user_collection_id/*', end: false },
      pathname
    )
    const publicAuthPages = ['/login', '/register', '/setup']
    const isOnPublicAuthPage = publicAuthPages.some(p => pathname.startsWith(p))

    console.log(
      '[AuthContext] hasToken=', hasToken,
      'isPublicCollectionRoute=', isPublicCollectionRoute,
      'isOnAuthPage=', isOnPublicAuthPage
    )

    if (!hasToken && !isPublicCollectionRoute && !isOnPublicAuthPage) {
      console.log('[AuthContext] no session & not a public page → redirecting')
      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 500)
    }
  }, [search, hash, pathname, navigate])

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}
