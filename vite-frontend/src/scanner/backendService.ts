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
  card_id: number;
  collector_number: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL;
const MAX_BASE64_LENGTH = 10_000_000; // ~7.5 MB decoded

/**
 * Sends a base64 data URL (e.g. canvas snapshot) to the backend for inference.
 */
export const sendROIToBackend = async (dataUrl: string): Promise<InferenceResult> => {
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('Invalid image data URL provided.');
  }

  const [header, base64] = dataUrl.split(',');
  if (!base64 || base64.length > MAX_BASE64_LENGTH) {
    throw new Error('Image data is too large or malformed.');
  }

  const mimeMatch = header.match(/data:(image\/[^;]+);base64/);
  if (!mimeMatch) {
    throw new Error('Unsupported image format in data URL.');
  }

  const mimeType = mimeMatch[1];
  const binary = atob(base64);
  const byteArray = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    byteArray[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([byteArray], { type: mimeType });
  const formData = new FormData();
  formData.append('roi_image', blob, `roi.${mimeType.split('/')[1]}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
const accessToken = localStorage.getItem('access_token'); // or however you store it
const response = await fetch(`${API_BASE_URL}/infer`, {
  method: 'POST',
  body: formData,
  signal: controller.signal,
  credentials: 'include',
  headers: {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  },
});

    if (!response.ok) {
      throw new Error(`Backend inference failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'name' in err && (err as { name?: string }).name === 'AbortError') {
      throw new Error('Request timed out.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};
