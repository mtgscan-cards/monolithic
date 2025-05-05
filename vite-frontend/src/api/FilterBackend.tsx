// src/api/FilterBackend.tsx
import { FilterCriteria } from '../components/FilterPanel';

export async function sendFilterCriteria(criteria: FilterCriteria) {
  console.log('Sending criteria to backend:', criteria);
  try {
    
    const response = await fetch('https://api.mtgscan.cards/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(criteria)
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
