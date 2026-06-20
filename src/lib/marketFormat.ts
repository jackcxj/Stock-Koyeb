export function formatChinaDateTime(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(iso));
}

export function formatSignedCount(value = 0): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

export function formatSignedPercent(value = 0): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function isAShareTradingSession(date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  if (weekday === 'Sat' || weekday === 'Sun') return false;

  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  const minutes = hour * 60 + minute;
  return (minutes >= 570 && minutes <= 690) || (minutes >= 780 && minutes <= 900);
}
