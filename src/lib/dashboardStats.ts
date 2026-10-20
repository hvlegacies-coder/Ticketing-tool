// KPI helpers for the dashboard, computed from tickets already in memory.
// Rolling 24h windows (not calendar days) so results don't depend on timezone.

const DAY = 24 * 60 * 60 * 1000;
type Dated = { created_at: string };

const ageInDays = (t: Dated, now: Date) => Math.floor((now.getTime() - new Date(t.created_at).getTime()) / DAY);

/** New tickets per day for the last 7 days, oldest first. */
export function dailyCounts(tickets: Dated[], now = new Date()): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const t of tickets) {
    const age = ageInDays(t, now);
    if (age >= 0 && age < 7) counts[6 - age]++;
  }
  return counts;
}

/** % change of the last 7 days vs the 7 before; null when there's no baseline. */
export function weekOverWeek(tickets: Dated[], now = new Date()): number | null {
  let current = 0;
  let previous = 0;
  for (const t of tickets) {
    const age = ageInDays(t, now);
    if (age >= 0 && age < 7) current++;
    else if (age >= 7 && age < 14) previous++;
  }
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
