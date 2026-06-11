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
