// src/api/cards.ts

const API_URL = import.meta.env.VITE_API_URL || 'https://api.mtgscan.cards'


export async function getAlternatePrintings(cardId: string) {
    try {
      const response = await fetch(`${API_URL}/api/cards/${cardId}/alternate`, {
        method: "GET",
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.results; // assuming your route returns { results: [...] }
    } catch (error) {
      console.error("Error fetching alternate printings:", error);
      throw error;
    }
  }
  