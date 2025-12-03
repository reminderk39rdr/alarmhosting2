import { API_BASE_URL } from '../config';
import type { AlertHistoryItem } from '../types';

export const fetchAlertHistory = async (
  limit = 20
): Promise<AlertHistoryItem[]> => {
  if (!API_BASE_URL) {
    return [];
  }
  const response = await fetch(
    `${API_BASE_URL}/alerts/history?limit=${limit}`,
    {
      credentials: 'include',
    }
  );
  if (!response.ok) {
    throw new Error('Gagal memuat alert history.');
  }
  const payload = await response.json();
  return payload.items ?? [];
};
