import api from './axios'

// Extend Axios to support custom behavior
declare module 'axios' {
  interface AxiosRequestConfig {
    skipRefreshOn401?: boolean
  }
}

export interface CollectionData {
  global_id: number
  user_collection_id: number
  label: string
  cardStackStateIndex: number
  color: { top: number; bottom: number }
  is_public: boolean
  is_manual_state: boolean
  username?: string
}

export interface CardData {
  id: number
  card_id: string // ← updated to string to match UUID schema
  added_at: string
  image_uris: { png: string }
  name?: string
  set?: string
  set_name?: string
  lang?: string
  layout?: string
}

export interface CreateCollectionPayload {
  label: string
  cardStackStateIndex: number
  color: { top: number; bottom: number }
  is_public?: boolean
  is_manual_state?: boolean
}

export async function createCollection(
  payload: CreateCollectionPayload
): Promise<CollectionData> {
  const { data } = await api.post<CollectionData>('/collections', payload)
  return data
}

export async function getCollections(): Promise<CollectionData[]> {
  const { data } = await api.get<CollectionData[]>('/collections')
  return data
}

export async function getCollection(
  username: string,
  user_collection_id: number
): Promise<CollectionData> {
  const { data } = await api.get<CollectionData>(
    `/collections/${username}/collection/${user_collection_id}`,
    {
      skipRefreshOn401: true
    }
  )
  return data
}

export async function getCollectionCards(
  username: string,
  user_collection_id: number
): Promise<CardData[]> {
  const { data } = await api.get<CardData[]>(
    `/collections/${username}/collection/${user_collection_id}/cards`
  )
  return data
}

export async function deleteCollectionCard(
  username: string,
  user_collection_id: number,
  collectionCardId: number
): Promise<void> {
  await api.delete(
    `/collections/${username}/collection/${user_collection_id}/cards/${collectionCardId}`
  )
}

export async function addCardToCollection(
  username: string,
  collectionId: number,
  cardId: string // ← updated to string for UUID
) {
  return await api.post(`/collections/${username}/collection/${collectionId}/cards`, {
    card_id: cardId,
  })
}

export async function addCardsByText(
  username: string,
  user_collection_id: number,
  inputText: string
): Promise<void> {
  await api.post(
    `/collections/${username}/collection/${user_collection_id}/bulk-add`,
    { text: inputText }
  )
}

export async function bulkAddToCollection(
  username: string,
  user_collection_id: number,
  text: string,
  lang: string = "en"
): Promise<{ added: number; failed: number }> {
  const { data } = await api.post(
    `/collections/${username}/collection/${user_collection_id}/bulk-add`,
    { text, lang },
    { withCredentials: true }
  )
  return data
}