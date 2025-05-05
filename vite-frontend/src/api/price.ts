// src/api/price.ts
import api from './axios';   // ← point at the file above

export async function getCurrentCollectionValue(
  collectionId: number
): Promise<{ collection_id: number; current_total_value: string }> {
  const response = await api.get(`/collection-value/${collectionId}/current`);
  return response.data;
}

export async function getCollectionValueHistory(
  collectionId: number,
  range: string = 'all'
): Promise<{
  collection_id: number;
  history: { snapshot_date: string; total_value: string }[];
}> {
  const response = await api.get(
    `/collection-value/${collectionId}/history?range=${range}`
  );
  return response.data;
}
