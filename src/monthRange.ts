// Keep the API's inclusive date bounds while editing ranges at month precision.
export function monthBoundary(value: string, end = false): string {
  if (!value) return '';
  const month = value.slice(0, 7);
  const [year, number] = month.split('-').map(Number);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || year < 1) return '';
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month + '-' + (end ? days[number - 1] : '01');
}

export function wholeMonthRange<T extends {date_from: string|null; date_to: string|null}>(range: T): T {
  return {...range, date_from: monthBoundary(range.date_from || '') || null,
    date_to: monthBoundary(range.date_to || '', true) || null};
}

// Historical results can still have day-specific bounds; display those exactly.
export function rangeDateLabel(value: string|null, end = false): string {
  if (!value) return '不限';
  return monthBoundary(value, end) === value ? value.slice(0, 7) : value;
}
