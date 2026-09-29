const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// '2026-09-18' → 'Fri, Sep 18'. Computed in UTC so the day never shifts with
// the phone's timezone.
export function formatGameDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS[month - 1]} ${day}`;
}

// Timestamp → 'Sep 15' in local time; '' when missing or invalid.
export function formatShortDate(timestamp: string | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

// Epoch ms → '6:42 PM' in local time.
export function formatTime(ms: number): string {
  const date = new Date(ms);
  const hours = date.getHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hour12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}
