/**
 * ClaudeKarma - Peak/Off-Peak Schedule
 *
 * Hardcoded for v1.2.0. Will be fetched from api.ailimits.app in v1.2.1.
 *
 * Source: https://support.claude.com/en/articles/14063676-claude-march-2026-usage-promotion
 * Verified: DevClass April 2026, The Register March 2026
 *
 * Peak hours affect 5-HOUR SESSION limits only (not weekly).
 * Session drain rate during peak: user-measured ~3-5x faster.
 * Weekly limits are unaffected by peak/off-peak state.
 */

export const PEAK_SCHEDULE = {
  version: 1,
  updated_at: '2026-04-24',
  source_url: 'https://support.claude.com/en/articles/14063676',

  // Peak windows in UTC — converted to user's local TZ at runtime
  schedule: {
    timezone: 'UTC',
    peak_windows: [
      // Monday=1 through Friday=5, 13:00-19:00 UTC (5-11 AM PT, 6-12 PM ET, 14-20 CET)
      { days: [1, 2, 3, 4, 5], start_hour: 13, end_hour: 19 }
    ]
  },

  impact: {
    // Peak affects session only, not weekly limits
    affects: ['session'],
    estimated_drain_multiplier: 3.5  // conservative mid-point of 3-5x user reports
  }
};

/**
 * Determine current peak state and time until next change.
 * @param {Date} now - Current time (defaults to new Date())
 * @returns {{ state: 'peak'|'off_peak', nextChangeAt: Date, nextState: string }}
 */
export function getCurrentPeakState(now) {
  now = now || new Date();
  const utcDay = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const utcHour = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();

  // Check if currently in any peak window
  for (const window of PEAK_SCHEDULE.schedule.peak_windows) {
    if (window.days.includes(utcDay) &&
        utcHour >= window.start_hour &&
        utcHour < window.end_hour) {
      // Currently in peak — find when it ends today
      const endDate = new Date(now);
      endDate.setUTCHours(window.end_hour, 0, 0, 0);
      return {
        state: 'peak',
        nextChangeAt: endDate,
        nextState: 'off_peak'
      };
    }
  }

  // Currently off-peak — find next peak start
  return {
    state: 'off_peak',
    nextChangeAt: getNextPeakStart(now),
    nextState: 'peak'
  };
}

/**
 * Compute the next timestamp when a peak window starts.
 */
function getNextPeakStart(now) {
  for (let offset = 0; offset < 8; offset++) {
    const check = new Date(now);
    check.setUTCDate(check.getUTCDate() + offset);

    const day = check.getUTCDay();
    for (const window of PEAK_SCHEDULE.schedule.peak_windows) {
      if (!window.days.includes(day)) continue;

      check.setUTCHours(window.start_hour, 0, 0, 0);
      if (check.getTime() > now.getTime()) {
        return check;
      }
    }
  }
  // Fallback: same time next week
  const fallback = new Date(now);
  fallback.setUTCDate(fallback.getUTCDate() + 7);
  return fallback;
}
