// src/api/FilterBackend.tsx
import { FilterCriteria } from '../components/filters/FilterPanel';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.mtgscan.cards';

export async function sendFilterCriteria(criteria: FilterCriteria) {
  console.log('Sending criteria to backend:', criteria);
  try {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(criteria),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Received response from backend:', data);
    return data;
  } catch (error) {
    console.error('Error communicating with backend:', error);
    throw error;
  }
}
