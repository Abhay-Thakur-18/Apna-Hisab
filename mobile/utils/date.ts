/**
 * Formats a date string (YYYY-MM-DD) and time string (HH:MM:SS) into a human-readable format.
 * Example: "2026-08-10" + "13:32:00" → "10 Aug 2026, 01:32 PM"
 */
export function formatDateTime(date: string, time?: string): string {
  if (!date) return '';
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  try {
    const [year, month, day] = date.split('-').map(Number);
    const monthName = months[month - 1] || '';
    const dayStr = String(day).padStart(2, '0');
    
    if (!time) {
      return `${dayStr} ${monthName} ${year}`;
    }
    
    const [hStr, mStr] = time.split(':');
    const hours = parseInt(hStr, 10);
    const minutes = mStr || '00';
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    const hourStr = String(hour12).padStart(2, '0');
    
    return `${dayStr} ${monthName} ${year}, ${hourStr}:${minutes} ${period}`;
  } catch {
    return date;
  }
}

/**
 * Formats just the date portion.
 * Example: "2026-08-10" → "10 Aug 2026"
 */
export function formatDate(date: string): string {
  return formatDateTime(date);
}

/**
 * Returns today's date string in YYYY-MM-DD format.
 */
export function todayDateStr(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns current time string in HH:MM:SS format.
 */
export function currentTimeStr(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${hh}:${min}:${ss}`;
}

/**
 * Returns a relative label for a date ("Today", "Yesterday", or formatted date).
 */
export function relativeDate(date: string): string {
  const today = todayDateStr();
  if (date === today) return 'Today';
  
  const todayDate = new Date(today);
  const d = new Date(date);
  const diffMs = todayDate.getTime() - d.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return formatDate(date);
}
