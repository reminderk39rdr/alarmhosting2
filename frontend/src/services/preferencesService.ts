import type { AlertPreference } from '../types';

const STORAGE_KEY = 'alarmhosting:alert_prefs';

const defaultPrefs: AlertPreference = {
  emailEnabled: true,
  slackEnabled: false,
  email: 'ops@company.id',
  slackChannel: '#ops-alert',
};

const isBrowser = () => typeof window !== 'undefined';

export const getStoredAlertPrefs = (): AlertPreference => {
  if (!isBrowser()) return defaultPrefs;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultPrefs;
  try {
    const parsed = JSON.parse(raw) as AlertPreference;
    return { ...defaultPrefs, ...parsed };
  } catch {
    return defaultPrefs;
  }
};

export const setStoredAlertPrefs = (prefs: AlertPreference) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
};
