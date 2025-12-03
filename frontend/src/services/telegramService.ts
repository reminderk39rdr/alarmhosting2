import { API_BASE_URL } from '../config';

interface TelegramActionPayload {
  reminderId: string;
  action: 'preview' | 'snooze' | 'mark_done';
  metadata?: Record<string, unknown>;
}

const simulateDelay = (ms = 700) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const sendTelegramAction = async ({
  reminderId,
  action,
  metadata,
}: TelegramActionPayload) => {
  if (!reminderId) {
    throw new Error('Reminder tidak ditemukan.');
  }

  if (!API_BASE_URL) {
    await simulateDelay();
    return {
      reminderId,
      action,
      metadata,
      status: 'ok',
      sentAt: new Date().toISOString(),
    };
  }

  const response = await fetch(`${API_BASE_URL}/actions/telegram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ reminderId, action, metadata }),
  });

  if (!response.ok) {
    const message =
      (await response.text()) || 'Gagal mengirim perintah Telegram.';
    throw new Error(message);
  }

  return response.json();
};
