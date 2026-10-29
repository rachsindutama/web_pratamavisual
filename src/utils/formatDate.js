/**
 * Format a date string (YYYY-MM-DD or any parseable format) into a nice display format.
 * e.g., "2026-03-15" → "March 15th, 2026"
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';

  let date;
  if (dateStr.includes('T')) {
    date = new Date(dateStr); // ISO string
  } else if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    date = new Date(dateStr + 'T00:00:00'); // YYYY-MM-DD format
  } else {
    return dateStr;
  }

  if (isNaN(date.getTime())) return dateStr;

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  // Add ordinal suffix
  const suffix = (d) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  return `${month} ${day}${suffix(day)}, ${year}`;
}

/**
 * Format a date string with time
 * e.g., "2026-03-15T14:30:00Z" → "March 15th, 2026, 14:30"
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '';

  let date;
  if (dateStr.includes('T')) {
    date = new Date(dateStr); // ISO string
  } else if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    date = new Date(dateStr + 'T00:00:00'); // YYYY-MM-DD format
  } else {
    return dateStr;
  }

  if (isNaN(date.getTime())) return dateStr;

  const datePart = formatDate(dateStr);
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${datePart}, ${hours}:${minutes}`;
}
