const normalize = (value: string | undefined) => {
  if (!value) return '';
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

export const API_BASE_URL = normalize(import.meta.env.VITE_API_BASE_URL);
