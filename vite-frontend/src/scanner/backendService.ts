// src/services/backendService.ts

export interface InferenceResult {
  predicted_card_id?: string;
  predicted_card_name: string;
  finishes: string[];
  set: string;
  set_name: string;
  prices: {
    eur: string;
    eur_foil: string;
    tix: string;
    usd: string;
    usd_etched: string | null;
    usd_foil: string;
  };
  image_uris: {
    art_crop: string;
    border_crop: string;
    large: string;
    normal: string;
    png: string;
    small: string;
  };
  card_id: number;               // ← required for ScannedCard.cardId
  collector_number: string;     // ← required for bulk add formatting
}

const API_BASE_URL = import.meta.env.VITE_API_URL;

export const sendROIToBackend = async (dataUrl: string): Promise<InferenceResult> => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const formData = new FormData();
  formData.append('roi_image', blob, 'roi.png');

  const response = await fetch(`${API_BASE_URL}/infer`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Backend inference failed: ${response.statusText}`);
  }

  return await response.json();
};