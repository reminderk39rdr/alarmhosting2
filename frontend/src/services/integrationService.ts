import { API_BASE_URL } from '../config';

const simulateDelay = (ms = 700) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const postIntegration = async (
  channel: 'email' | 'slack',
  payload: Record<string, unknown>
) => {
  if (!API_BASE_URL) {
    await simulateDelay();
    return { channel, ...payload, status: 'sent' };
  }

  const response = await fetch(
    `${API_BASE_URL}/integrations/${channel}/test`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const message =
      (await response.text()) || `Gagal mengirim test ${channel}.`;
    throw new Error(message);
  }

  return response.json();
};

export const sendEmailTest = async (email: string) => {
  if (!email) {
    throw new Error('Alamat email belum diatur.');
  }
  return postIntegration('email', { email });
};

export const sendSlackTest = async (channel: string) => {
  if (!channel) {
    throw new Error('Channel Slack belum diatur.');
  }
  return postIntegration('slack', { channel });
};
