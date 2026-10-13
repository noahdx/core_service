type TimeUnit = 's' | 'm' | 'h' | 'd';

const multipliers: Record<TimeUnit, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function toMs(value: number, unit: TimeUnit) {
  return multipliers[unit] * value;
}

export function toSeconds(value: number, unit: TimeUnit): number {
  return toMs(value, unit) / 1000;
}
