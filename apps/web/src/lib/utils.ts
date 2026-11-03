import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function formatMoney(kopecks: number) {
  if (!Number.isSafeInteger(kopecks) || kopecks < 0) throw new Error('Invalid display amount');
  const whole = Math.floor(kopecks / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  const fraction = kopecks % 100;
  return `${whole}${fraction ? `,${String(fraction).padStart(2, '0')}` : ''}\u00a0₴`;
}
