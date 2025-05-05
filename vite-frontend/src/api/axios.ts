// src/api/axios.ts
import axios, { AxiosRequestConfig } from 'axios'

/**
 * Extend AxiosRequestConfig to allow our custom flags.
 */
declare module 'axios' {
  export interface AxiosRequestConfig {
    /** When true, skip triggering a token refresh on 401 responses */
    skipRefreshOn401?: boolean
    /** Internal flag to ensure we only retry once */
    _retry?: boolean
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true,
})

// On startup, restore any saved access token
const savedToken = localStorage.getItem('access_token')
if (savedToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
}

// Attach the latest token (if any) to every request
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('access_token')
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error)
)

let isRefreshing = false
let subscribers: Array<(token: string) => void> = []

function onRefreshed(token: string) {
  subscribers.forEach(cb => cb(token))
  subscribers = []
}

function addSubscriber(cb: (token: string) => void) {
  subscribers.push(cb)
}

api.interceptors.response.use(
  response => response,
  error => {
    const { config, response } = error
    const originalRequest = config as AxiosRequestConfig

    // 1) If this was a 401 on a request with skipRefreshOn401, just reject after a short delay
    if (response?.status === 401 && originalRequest.skipRefreshOn401) {
      return new Promise((_, reject) => {
        setTimeout(() => reject(error), 3000)
      })
    }

    // 2) Otherwise, for all other 401s, do the usual refresh-or-redirect flow
    if (response?.status === 401 && !originalRequest._retry) {
      // a) If the refresh endpoint itself failed, clear & force login
      if (originalRequest.url?.includes('/auth/refresh')) {
        localStorage.removeItem('access_token')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      // b) If a refresh is already in flight, queue this request
      if (isRefreshing) {
        return new Promise(resolve => {
          addSubscriber(token => {
            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${token}`
            }
            resolve(api(originalRequest))
          })
        })
      }

      // c) First 401 → attempt refresh
      originalRequest._retry = true
      isRefreshing = true

      return api
        .post('/auth/refresh')  // sends HttpOnly cookie
        .then(({ data }) => {
          const newToken = data.access_token
          localStorage.setItem('access_token', newToken)
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
          onRefreshed(newToken)
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`
          }
          // retry the original request
          return api(originalRequest)
        })
        .catch(err => {
          localStorage.removeItem('access_token')
          window.location.href = '/login'
          return Promise.reject(err)
        })
        .finally(() => {
          isRefreshing = false
        })
    }

    return Promise.reject(error)
  }
)

export default api
