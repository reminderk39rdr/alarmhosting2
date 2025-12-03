import { API_BASE_URL } from '../config';
import type { CalendarResponse, Reminder, Resource } from '../types';

const computeFallback = (
  reminders: Reminder[],
  resources: Resource[],
  range = 30
): CalendarResponse => {
  const now = new Date();
  const events = reminders
    .map((reminder) => ({
      ...reminder,
      resource: resources.find((item) => item.id === reminder.resourceId),
    }))
    .filter((item) => {
      if (!item.resource) return false;
      const eventDate = new Date(item.scheduledFor);
      const diffInDays =
        (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diffInDays <= range && diffInDays >= -30;
    });

  const grouped = events.reduce<Record<string, typeof events>>((acc, event) => {
    const dateKey = event.scheduledFor.slice(0, 10);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  const days = Object.entries(grouped)
    .sort(
      ([a], [b]) =>
        new Date(a).getTime() - new Date(b).getTime()
    )
    .map(([date, items]) => ({ date, events: items }));

  return { range, count: events.length, days };
};

export const fetchCalendarData = async (
  reminders: Reminder[],
  resources: Resource[],
  params: { range?: number } = {}
): Promise<CalendarResponse> => {
  const { range = 30 } = params;

  if (!API_BASE_URL) {
    return computeFallback(reminders, resources, range);
  }

  const query = new URLSearchParams({ range: String(range) });

  try {
    const response = await fetch(`${API_BASE_URL}/calendar?${query}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Gagal memuat kalender dari server.');
    }
    return (await response.json()) as CalendarResponse;
  } catch (error) {
    console.warn('[calendar] fallback ke lokal:', error);
    return computeFallback(reminders, resources, range);
  }
};

export const buildCsvFromCalendar = (calendar: CalendarResponse) => {
  const rows = [['Date', 'Resource', 'Type', 'Status', 'Message']];
  calendar.days.forEach((day) => {
    day.events.forEach((event) => {
      rows.push([
        day.date,
        event.resource?.label ?? event.resourceId,
        event.resource?.type ?? 'unknown',
        event.resource?.status ?? '-',
        event.message ?? '',
      ]);
    });
  });
  return rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
};
