export function winBackDue(input: { last: Date | null; now: Date }) {
  const day = 86400000;
  return !!input.last && input.now.getTime() - input.last.getTime() >= 30 * day;
}
