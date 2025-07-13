// src/api/FilterBackend.tsx
import { FilterCriteria } from '../components/filters/FilterPanel'
import api from './axios'

export async function sendFilterCriteria(criteria: FilterCriteria) {
  console.log('Sending criteria to backend:', criteria)
  try {
    const response = await api.post('/api/search', criteria)
    console.log('Received response from backend:', response.data)
    return response.data
  } catch (error) {
    console.error('Error communicating with backend:', error)
    throw error
  }
}