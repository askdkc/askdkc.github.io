const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC'
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}
