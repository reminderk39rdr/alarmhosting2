import type { SeedData } from '../types';
import { API_BASE_URL } from '../config';

const fetchLocalSeed = async (): Promise<SeedData> => {
  const response = await fetch('/data/seed.json');
  if (!response.ok) {
    throw new Error('Gagal memuat data lokal.');
  }
  return (await response.json()) as SeedData;
};

export const fetchSeedData = async (): Promise<SeedData> => {
  if (!API_BASE_URL) {
    return fetchLocalSeed();
  }

  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/overview`, {
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Gagal memuat data dari server.');
    }
    return (await response.json()) as SeedData;
  } catch (error) {
    console.warn(
      '[dataService] fallback ke seed lokal karena error:',
      error
    );
    return fetchLocalSeed();
  }
};
