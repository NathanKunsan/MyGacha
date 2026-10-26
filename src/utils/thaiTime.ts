/**
 * Utility for Thailand time calculations (UTC+7).
 */

/**
 * Calculates how many days have passed since a given timestamp,
 * where each new day advances at Thailand Noon (12:00:00 PM UTC+7).
 *
 * Thailand (Asia/Bangkok) is UTC+7 with no Daylight Saving Time.
 * 12:00:00 PM Thailand time = 05:00:00 AM UTC.
 * Shifting any UTC timestamp by -5 hours maps Thailand's noon boundary
 * directly onto the standard UTC day boundary (00:00:00 UTC).
 */
export const getThailandNoonDaysPassed = (lastDateIsoOrMs: string | number): number => {
  const lastTime =
    typeof lastDateIsoOrMs === 'string'
      ? new Date(lastDateIsoOrMs).getTime()
      : lastDateIsoOrMs;

  if (isNaN(lastTime)) return 999;

  const now = Date.now();
  if (now <= lastTime) return 0;

  const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Compute the cycle index (integer day number where boundary is Thailand noon)
  const lastCycle = Math.floor((lastTime - FIVE_HOURS_MS) / ONE_DAY_MS);
  const nowCycle = Math.floor((now - FIVE_HOURS_MS) / ONE_DAY_MS);

  return Math.max(0, nowCycle - lastCycle);
};

export interface UsernameCooldownStatus {
  canChange: boolean;
  remainingDays: number;
  daysPassed: number;
}

/**
 * Checks whether the user can change their username under the cooldown rule,
 * where days advance each day at 12:00 PM (Thailand noon).
 */
export const getUsernameChangeStatus = (
  lastDateIso?: string | null,
  cooldownDays = 15
): UsernameCooldownStatus => {
  if (!lastDateIso) {
    return { canChange: true, remainingDays: 0, daysPassed: cooldownDays };
  }

  const daysPassed = getThailandNoonDaysPassed(lastDateIso);
  if (daysPassed >= cooldownDays) {
    return { canChange: true, remainingDays: 0, daysPassed };
  }

  return {
    canChange: false,
    remainingDays: cooldownDays - daysPassed,
    daysPassed,
  };
};
