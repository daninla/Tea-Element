export function winBackDue(input: { count: number; first: Date; last: Date; now: Date }) {
  const day = 86400000;
  if (input.count < 1 || input.last > input.now) return false;
  const averageDays =
    input.count > 1 ? (input.last.getTime() - input.first.getTime()) / (input.count - 1) / day : 0;
  const days = Math.max(30, Math.ceil(1.5 * averageDays));
  return input.now.getTime() - input.last.getTime() >= days * day;
}
