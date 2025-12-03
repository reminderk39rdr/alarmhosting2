import { API_BASE_URL } from '../config';

const STORAGE_KEY = 'alarmhosting:selected_user';
const isBrowser = () => typeof window !== 'undefined';
const apiAvailable = Boolean(API_BASE_URL);

const getStoredUserId = () => {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(STORAGE_KEY);
};

const setStoredUserId = (userId: string) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, userId);
};

const clearStoredUserId = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
};

export const fetchSessionUser = async (): Promise<string | null> => {
  if (!apiAvailable) {
    return getStoredUserId();
  }
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: 'include',
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.user?.id ?? null;
};

export const loginUser = async (userId: string) => {
  if (!apiAvailable) {
    setStoredUserId(userId);
    return { userId };
  }
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) {
    const message = (await response.text()) || 'Login gagal.';
    throw new Error(message);
  }
  return response.json();
};

export const logoutUser = async () => {
  if (!apiAvailable) {
    clearStoredUserId();
    return;
  }
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
};
