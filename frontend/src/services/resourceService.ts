import { API_BASE_URL } from '../config';
import type { ResourceType, Resource } from '../types';

interface CreateResourcePayload {
  type: ResourceType;
  label: string;
  provider: string;
  expiryDate: string;
  hostname?: string;
  renewalUrl?: string;
  notes?: string;
}

export const createResource = async (
  payload: CreateResourcePayload
): Promise<Resource> => {
  if (!API_BASE_URL) {
    return {
      id: `res-local-${Date.now()}`,
      type: payload.type,
      label: payload.label,
      hostname:
        payload.hostname ??
        payload.label.toLowerCase().replace(/\s+/g, '-') + '.local',
      provider: payload.provider,
      expiryDate: payload.expiryDate,
      status: 'healthy',
      renewalUrl: payload.renewalUrl ?? '',
      notes: payload.notes ?? '',
      lastChecked: new Date().toISOString(),
      tags: [],
    };
  }

  const response = await fetch(`${API_BASE_URL}/resources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = (await response.text()) || 'Gagal membuat resource.';
    throw new Error(message);
  }

  return (await response.json()) as Resource;
};
