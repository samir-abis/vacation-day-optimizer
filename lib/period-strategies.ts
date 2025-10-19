import { Holiday } from "./holidays";
import { VacationPeriod } from "./types";
import {
  addDays,
  isValidDate,
  isWorkday,
  calculateTotalDaysOffInclusive,
} from "./date-utils";

// --- Scoring Weights ---
// These can be adjusted to fine-tune the optimization
const EFFICIENCY_WEIGHT = 1.5; // Prioritize getting more days off per vacation day used
const SHORT_GAP_WEIGHT = 1; // Prioritize using fewer vacation days (filling shorter gaps)
const TOTAL_LENGTH_WEIGHT = 1; // Favor longer resulting breaks
const EARLY_MONTH_PENALTY_FACTOR = 0.05; // Slightly deprioritize very early months if budget is limited
const HOLIDAY_INCLUSION_BONUS = 1.5; // Extra points for periods that include a public holiday
const REMOTE_DAY_INCLUSION_BONUS = 2; // Bonus for each remote day included in the off-period
const REMOTE_DAY_VACATION_PENALTY = 5; // Penalty for using vacation days on remote workdays
const NEXT_YEAR_VACATION_PENALTY = 5; // Penalty per vacation day used in the next year
const MIN_SCORE_THRESHOLD = 20; // Only select periods scoring above this value

// --- Potential Period Interface ---
export interface PotentialPeriod extends VacationPeriod {
  score: number;
  type: "bridge" | "holiday-link" | "long-weekend" | "holiday-bridge";
  month: number; // 0-11
}

// --- Helper function to find the true start of an off-period ---
export function findPeriodStart(
  vacationStartDate: Date,
  workdayNumbers: number[],
  holidayDates: Set<string>,
  companyVacationDates: Set<string>,
  remoteWorkdayDates: Set<string>
): Date {
  if (!isValidDate(vacationStartDate)) {
    console.error(
      "Invalid vacationStartDate passed to findPeriodStart:",
      vacationStartDate
    );
    return vacationStartDate;
  }

  let current = new Date(vacationStartDate);
  let iterations = 0;
  const maxIterations = 30;

  while (iterations < maxIterations) {
    const dayBefore = addDays(current, -1);
    if (!isValidDate(dayBefore)) {
      console.error(
        "Invalid date calculated in findPeriodStart (dayBefore):",
        dayBefore,
        " from current:",
        current
      );
      break;
    }
    const dayBeforeStr = dayBefore.toISOString().split("T")[0];
    if (
      isWorkday(dayBefore, workdayNumbers) &&
      !holidayDates.has(dayBeforeStr) &&
      !companyVacationDates.has(dayBeforeStr) &&
      !remoteWorkdayDates.has(dayBeforeStr)
    ) {
      break;
    }
    current = dayBefore;
    iterations++;
  }

  if (iterations === maxIterations) {
    console.warn(
      "findPeriodStart reached max iterations for date:",
      vacationStartDate.toISOString().split("T")[0]
    );
  }
  return current;
}

// --- Helper function to find the true end of an off-period ---
export function findPeriodEnd(
  vacationEndDate: Date,
  workdayNumbers: number[],
  holidayDates: Set<string>,
  companyVacationDates: Set<string>,
  remoteWorkdayDates: Set<string>
): Date {
  if (!isValidDate(vacationEndDate)) {
    console.error(
      "Invalid vacationEndDate passed to findPeriodEnd:",
      vacationEndDate
    );
    return vacationEndDate;
  }

  let current = new Date(vacationEndDate);
  let iterations = 0;
  const maxIterations = 30;

  while (iterations < maxIterations) {
    const dayAfter = addDays(current, 1);
    if (!isValidDate(dayAfter)) {
      console.error(
        "Invalid date calculated in findPeriodEnd (dayAfter):",
        dayAfter,
        " from current:",
        current
      );
      break;
    }
    const dayAfterStr = dayAfter.toISOString().split("T")[0];
    if (
      isWorkday(dayAfter, workdayNumbers) &&
      !holidayDates.has(dayAfterStr) &&
      !companyVacationDates.has(dayAfterStr) &&
      !remoteWorkdayDates.has(dayAfterStr)
    ) {
      break;
    }
    current = dayAfter;
    iterations++;
  }

  if (iterations === maxIterations) {
    console.warn(
      "findPeriodEnd reached max iterations for date:",
      vacationEndDate.toISOString().split("T")[0]
    );
  }
  return current;
}

// --- Calculate Period Score ---
function calculateScore(
  period: Omit<PotentialPeriod, "score">,
  remoteWorkdayDates: Set<string>
): number {
  if (!period.vacationDays || period.vacationDays.length === 0) {
    return -Infinity; // Invalid period
  }

  const efficiency = period.totalDays / period.vacationDays.length;
  const normalizedEfficiency = Math.max(0, efficiency); // Ensure non-negative

  // Higher score for fewer vacation days used (1/length)
  const shortGapFactor = 1 / period.vacationDays.length;

  // Penalty for being early in the year (scale from 0 for Jan to 1 for Dec)
  // This encourages spreading holidays out if budget allows
  const monthFactor = 1 - (11 - period.month) / 11;
  const earlyPenalty = monthFactor * EARLY_MONTH_PENALTY_FACTOR;

  // Bonus for including a holiday
  const includesHoliday =
    period.includes?.some((inc) => inc.type === "holiday") || false;
  const holidayBonus = includesHoliday ? HOLIDAY_INCLUSION_BONUS : 0;

  // Bonus for including remote work days (that aren't vacation days)
  let remoteDayBonus = 0;
  // Penalty for using vacation days on remote workdays
  let remoteVacationPenalty = 0;

  const vacationDaysSet = new Set(
    period.vacationDays.map((d) => d.toISOString().split("T")[0])
  );

  // DEBUG: Log vacation days for inspection
  // console.log(
  //   `Scoring Period: ${period.startDate.toISOString().split("T")[0]} - ${period.endDate.toISOString().split("T")[0]}`
  // );
  // console.log(`  Vacation Days: ${Array.from(vacationDaysSet).join(", ")}`);

  const current = new Date(period.startDate);
  const end = new Date(period.endDate);

  // Remote days with penalty
  const penalizedDays: string[] = [];

  // Next year vacation penalty
  let nextYearVacationPenalty = 0;
  const currentYearStr = period.startDate.getUTCFullYear().toString();
  const vacationDaysInNextYear = period.vacationDays.filter(
    (day) => day.getUTCFullYear().toString() !== currentYearStr
  );
  nextYearVacationPenalty =
    vacationDaysInNextYear.length * NEXT_YEAR_VACATION_PENALTY;

  // Debug logging for next year penalty
  // if (vacationDaysInNextYear.length > 0) {
  //   console.log(
  //     `  ⚠️ Penalized ${vacationDaysInNextYear.length} vacation days in next year: ${vacationDaysInNextYear.map((d) => d.toISOString().split("T")[0]).join(", ")}`
  //   );
  //   console.log(
  //     `  ⚠️ Next year penalty: -${nextYearVacationPenalty.toFixed(2)}`
  //   );
  // }

  while (current <= end) {
    const currentStr = current.toISOString().split("T")[0];
    if (
      remoteWorkdayDates.has(currentStr) &&
      !vacationDaysSet.has(currentStr)
    ) {
      remoteDayBonus += REMOTE_DAY_INCLUSION_BONUS;
    }

    // Add penalty for using vacation on remote days
    if (remoteWorkdayDates.has(currentStr) && vacationDaysSet.has(currentStr)) {
      remoteVacationPenalty += REMOTE_DAY_VACATION_PENALTY;
      penalizedDays.push(currentStr);
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  // DEBUG: Check if any remote vacation days were penalized
  // if (penalizedDays.length > 0) {
  //   console.log(
  //     `  ⚠️ Penalized ${penalizedDays.length} remote vacation days: ${penalizedDays.join(", ")}`
  //   );
  //   console.log(`  ⚠️ Total penalty: -${remoteVacationPenalty.toFixed(2)}`);
  // }

  const score =
    normalizedEfficiency * EFFICIENCY_WEIGHT +
    shortGapFactor * SHORT_GAP_WEIGHT +
    period.totalDays * TOTAL_LENGTH_WEIGHT - // Bonus for total length
    earlyPenalty +
    holidayBonus + // Add the holiday bonus
    remoteDayBonus - // Add the remote day bonus
    remoteVacationPenalty - // Subtract the remote vacation penalty
    nextYearVacationPenalty; // Subtract the next year vacation penalty

  return score;
}

// --- Check for overlaps using vacation days ---
function doVacationDaysOverlap(
  newPeriodDays: Date[],
  existingPeriods: PotentialPeriod[]
): boolean {
  const newVacationSet = new Set(
    newPeriodDays.map((d) => d.toISOString().split("T")[0])
  );

  for (const existing of existingPeriods) {
    for (const existingVD of existing.vacationDays) {
      if (newVacationSet.has(existingVD.toISOString().split("T")[0])) {
        return true;
      }
    }
  }
  return false;
}

// --- Get included non-work days/holidays/company days ---
function getIncludedDaysInfo(
  periodStartDate: Date,
  periodEndDate: Date,
  holidays: Holiday[],
  workdayNumbers: number[],
  companyVacationDates: Set<string>,
  vacationDaysSet: Set<string>
): { type: "weekend" | "holiday" | "company"; name?: string }[] {
  const includes: { type: "weekend" | "holiday" | "company"; name?: string }[] =
    [];
  const holidayMap = new Map<string, string>();
  holidays.forEach((h) =>
    holidayMap.set(h.date.toISOString().split("T")[0], h.name)
  );

  let hasWeekend = false; // Track if we've added 'weekend' already
  const currentDate = new Date(periodStartDate);
  const end = new Date(periodEndDate);

  while (currentDate <= end) {
    const currentDayStr = currentDate.toISOString().split("T")[0];
    const dayOfWeek = currentDate.getUTCDay();

    // Only include if it's *not* one of the planned vacation days
    if (!vacationDaysSet.has(currentDayStr)) {
      if (!workdayNumbers.includes(dayOfWeek)) {
        if (!hasWeekend) {
          includes.push({ type: "weekend" });
          hasWeekend = true; // Only add one 'weekend' badge per period
        }
      } else if (holidayMap.has(currentDayStr)) {
        includes.push({
          type: "holiday",
          name: holidayMap.get(currentDayStr),
        });
      } else if (companyVacationDates.has(currentDayStr)) {
        // Ensure company days aren't counted if they are *also* the vacation days
        // This scenario shouldn't happen with pre-filtering but good safety check
        includes.push({
          type: "company",
          name: "Company Vacation",
        });
      }
    }

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  // Ensure uniqueness based on type and name (especially for holidays)
  const uniqueIncludes = Array.from(
    new Map(includes.map((item) => [JSON.stringify(item), item])).values()
  );

  return uniqueIncludes;
}

// --- Generate Potential Bridge Periods ---
function generatePotentialBridgePeriods(
  availableWorkdays: Date[],
  holidays: Holiday[],
  holidayDates: Set<string>,
  workdayNumbers: number[],
  companyVacationDates: Set<string>,
  remoteWorkdayDates: Set<string>,
  maxBridgeLength: number = 4
): PotentialPeriod[] {
  const potentialPeriods: PotentialPeriod[] = [];

  // IMPORTANT: Filter out remote days from available workdays right at the start
  const nonRemoteWorkdays = availableWorkdays.filter((day) => {
    const dayStr = day.toISOString().split("T")[0];
    return !remoteWorkdayDates.has(dayStr);
  });

  // console.log(
  //   `[Bridge Generator] Filtering remote days: Original workdays: ${availableWorkdays.length}, After filtering: ${nonRemoteWorkdays.length}`
  // );

  const availableWorkdaysSet = new Set(
    nonRemoteWorkdays.map((d) => d.toISOString().split("T")[0])
  );

  for (let i = 0; i < nonRemoteWorkdays.length; i++) {
    const startDay = nonRemoteWorkdays[i];
    const startDayStr = startDay.toISOString().split("T")[0];

    if (companyVacationDates.has(startDayStr)) continue;

    for (let len = 1; len <= maxBridgeLength; len++) {
      const vacationDays: Date[] = [new Date(startDay)];
      let possible = true;
      let lastDayInBridge = new Date(startDay);

      for (let dayIdx = 1; dayIdx < len; dayIdx++) {
        const nextDay = addDays(startDay, dayIdx);
        const nextDayStr = nextDay.toISOString().split("T")[0];

        if (
          !availableWorkdaysSet.has(nextDayStr) ||
          companyVacationDates.has(nextDayStr)
        ) {
          possible = false;
          break;
        }
        vacationDays.push(new Date(nextDay));
        lastDayInBridge = new Date(nextDay);
      }

      if (!possible) continue;

      const dayBeforeStart = addDays(startDay, -1);
      const dayAfterEnd = addDays(lastDayInBridge, 1);
      const dayBeforeStartStr = dayBeforeStart.toISOString().split("T")[0];
      const dayAfterEndStr = dayAfterEnd.toISOString().split("T")[0];

      const isAfterNonOffice =
        !isWorkday(dayBeforeStart, workdayNumbers) ||
        holidayDates.has(dayBeforeStartStr) ||
        companyVacationDates.has(dayBeforeStartStr) ||
        remoteWorkdayDates.has(dayBeforeStartStr);

      const isBeforeNonOffice =
        !isWorkday(dayAfterEnd, workdayNumbers) ||
        holidayDates.has(dayAfterEndStr) ||
        companyVacationDates.has(dayAfterEndStr) ||
        remoteWorkdayDates.has(dayAfterEndStr);

      if (isAfterNonOffice && isBeforeNonOffice) {
        const periodStartDate = findPeriodStart(
          startDay,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        );
        const periodEndDate = findPeriodEnd(
          lastDayInBridge,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        );
        const totalDaysOff = calculateTotalDaysOffInclusive(
          periodStartDate,
          periodEndDate
        );
        const vacationDaysSet = new Set(
          vacationDays.map((d) => d.toISOString().split("T")[0])
        );
        const includes = getIncludedDaysInfo(
          periodStartDate,
          periodEndDate,
          holidays,
          workdayNumbers,
          companyVacationDates,
          vacationDaysSet
        );
        const month = startDay.getUTCMonth();

        const potentialPeriodBase = {
          startDate: periodStartDate,
          endDate: periodEndDate,
          vacationDays,
          totalDays: totalDaysOff,
          efficiency: totalDaysOff / vacationDays.length,
          includes,
          isCompanyVacation: false,
          type: "bridge" as const,
          month,
        };

        potentialPeriods.push({
          ...potentialPeriodBase,
          score: calculateScore(potentialPeriodBase, remoteWorkdayDates),
        });
      }
    }
  }

  return potentialPeriods;
}

// --- Generate Potential Holiday Link Periods ---
function generatePotentialHolidayLinkPeriods(
  availableWorkdays: Date[],
  holidays: Holiday[],
  holidayDates: Set<string>,
  workdayNumbers: number[],
  companyVacationDates: Set<string>,
  remoteWorkdayDates: Set<string>
): PotentialPeriod[] {
  const potentialPeriods: PotentialPeriod[] = [];

  // IMPORTANT: Filter out remote days from available workdays right at the start
  const nonRemoteWorkdays = availableWorkdays.filter((day) => {
    const dayStr = day.toISOString().split("T")[0];
    return !remoteWorkdayDates.has(dayStr);
  });

  // console.log(
  //   `[Holiday Link Generator] Filtering remote days: Original workdays: ${availableWorkdays.length}, After filtering: ${nonRemoteWorkdays.length}`
  // );

  const availableWorkdaysSet = new Set(
    nonRemoteWorkdays.map((d) => d.toISOString().split("T")[0])
  );

  for (const holiday of holidays) {
    const holidayDate = holiday.date;
    const holidayStr = holidayDate.toISOString().split("T")[0];

    for (let offsetDirection = -1; offsetDirection <= 1; offsetDirection += 2) {
      const potentialVacationDay1 = addDays(holidayDate, offsetDirection);
      const day1Str = potentialVacationDay1.toISOString().split("T")[0];

      if (availableWorkdaysSet.has(day1Str)) {
        const vacationDays: Date[] = [new Date(potentialVacationDay1)];
        const periodStartDate = findPeriodStart(
          vacationDays[0],
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        );
        const periodEndDate = findPeriodEnd(
          vacationDays[vacationDays.length - 1],
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        );
        const totalDaysOff = calculateTotalDaysOffInclusive(
          periodStartDate,
          periodEndDate
        );
        const vacationDaysSet = new Set(
          vacationDays.map((d) => d.toISOString().split("T")[0])
        );
        const includes = getIncludedDaysInfo(
          periodStartDate,
          periodEndDate,
          holidays,
          workdayNumbers,
          companyVacationDates,
          vacationDaysSet
        );
        const month = potentialVacationDay1.getUTCMonth();

        const potentialPeriodBase1 = {
          startDate: periodStartDate,
          endDate: periodEndDate,
          vacationDays,
          totalDays: totalDaysOff,
          efficiency: totalDaysOff / vacationDays.length,
          includes,
          isCompanyVacation: false,
          type: "holiday-link" as const,
          month,
        };
        potentialPeriods.push({
          ...potentialPeriodBase1,
          score: calculateScore(potentialPeriodBase1, remoteWorkdayDates),
        });

        const potentialVacationDay2 = addDays(
          potentialVacationDay1,
          offsetDirection
        );
        const day2Str = potentialVacationDay2.toISOString().split("T")[0];

        if (availableWorkdaysSet.has(day2Str)) {
          const vacationDays2: Date[] = [
            new Date(potentialVacationDay1),
            new Date(potentialVacationDay2),
          ];
          vacationDays2.sort((a, b) => a.getTime() - b.getTime());

          const periodStartDate2 = findPeriodStart(
            vacationDays2[0],
            workdayNumbers,
            holidayDates,
            companyVacationDates,
            remoteWorkdayDates
          );
          const periodEndDate2 = findPeriodEnd(
            vacationDays2[vacationDays2.length - 1],
            workdayNumbers,
            holidayDates,
            companyVacationDates,
            remoteWorkdayDates
          );
          const totalDaysOff2 = calculateTotalDaysOffInclusive(
            periodStartDate2,
            periodEndDate2
          );
          const vacationDaysSet2 = new Set(
            vacationDays2.map((d) => d.toISOString().split("T")[0])
          );
          const includes2 = getIncludedDaysInfo(
            periodStartDate2,
            periodEndDate2,
            holidays,
            workdayNumbers,
            companyVacationDates,
            vacationDaysSet2
          );
          const month2 = vacationDays2[0].getUTCMonth();

          const potentialPeriodBase2 = {
            startDate: periodStartDate2,
            endDate: periodEndDate2,
            vacationDays: vacationDays2,
            totalDays: totalDaysOff2,
            efficiency: totalDaysOff2 / vacationDays2.length,
            includes: includes2,
            isCompanyVacation: false,
            type: "holiday-link" as const,
            month: month2,
          };
          potentialPeriods.push({
            ...potentialPeriodBase2,
            score: calculateScore(potentialPeriodBase2, remoteWorkdayDates),
          });
        }
      }
    }
  }

  const uniquePeriodsMap = new Map<string, PotentialPeriod>();
  potentialPeriods.forEach((p) => {
    const key = p.vacationDays
      .map((d) => d.toISOString().split("T")[0])
      .sort()
      .join(",");
    if (
      !uniquePeriodsMap.has(key) ||
      p.score > (uniquePeriodsMap.get(key)?.score ?? -Infinity)
    ) {
      uniquePeriodsMap.set(key, p);
    }
  });

  return Array.from(uniquePeriodsMap.values());
}

// --- Generate Potential Long Weekend Periods ---
function generatePotentialLongWeekendPeriods(
  availableWorkdays: Date[],
  holidays: Holiday[],
  holidayDates: Set<string>,
  workdayNumbers: number[],
  companyVacationDates: Set<string>,
  remoteWorkdayDates: Set<string>
): PotentialPeriod[] {
  const potentialPeriods: PotentialPeriod[] = [];

  // IMPORTANT: Filter out remote days from available workdays right at the start
  const nonRemoteWorkdays = availableWorkdays.filter((day) => {
    const dayStr = day.toISOString().split("T")[0];
    return !remoteWorkdayDates.has(dayStr);
  });

  // console.log(
  //   `[Long Weekend Generator] Filtering remote days: Original workdays: ${availableWorkdays.length}, After filtering: ${nonRemoteWorkdays.length}`
  // );

  const availableWorkdaysSet = new Set(
    nonRemoteWorkdays.map((d) => d.toISOString().split("T")[0])
  );

  for (const day of nonRemoteWorkdays) {
    const dayStr = day.toISOString().split("T")[0];
    const dayOfWeek = day.getUTCDay();

    if (dayOfWeek === 5) {
      const vacationDays = [new Date(day)];
      const periodStartDate = findPeriodStart(
        day,
        workdayNumbers,
        holidayDates,
        companyVacationDates,
        remoteWorkdayDates
      );
      const periodEndDate = findPeriodEnd(
        day,
        workdayNumbers,
        holidayDates,
        companyVacationDates,
        remoteWorkdayDates
      );
      const totalDaysOff = calculateTotalDaysOffInclusive(
        periodStartDate,
        periodEndDate
      );
      const vacationDaysSet = new Set([dayStr]);
      const includes = getIncludedDaysInfo(
        periodStartDate,
        periodEndDate,
        holidays,
        workdayNumbers,
        companyVacationDates,
        vacationDaysSet
      );
      const month = day.getUTCMonth();
      const potentialPeriodBase = {
        startDate: periodStartDate,
        endDate: periodEndDate,
        vacationDays,
        totalDays: totalDaysOff,
        efficiency: totalDaysOff / 1,
        includes,
        isCompanyVacation: false,
        type: "long-weekend" as const,
        month,
      };
      potentialPeriods.push({
        ...potentialPeriodBase,
        score: calculateScore(potentialPeriodBase, remoteWorkdayDates),
      });
    }

    if (dayOfWeek === 1) {
      const vacationDays = [new Date(day)];
      const periodStartDate = findPeriodStart(
        day,
        workdayNumbers,
        holidayDates,
        companyVacationDates,
        remoteWorkdayDates
      );
      const periodEndDate = findPeriodEnd(
        day,
        workdayNumbers,
        holidayDates,
        companyVacationDates,
        remoteWorkdayDates
      );
      const totalDaysOff = calculateTotalDaysOffInclusive(
        periodStartDate,
        periodEndDate
      );
      const vacationDaysSet = new Set([dayStr]);
      const includes = getIncludedDaysInfo(
        periodStartDate,
        periodEndDate,
        holidays,
        workdayNumbers,
        companyVacationDates,
        vacationDaysSet
      );
      const month = day.getUTCMonth();
      const potentialPeriodBase = {
        startDate: periodStartDate,
        endDate: periodEndDate,
        vacationDays,
        totalDays: totalDaysOff,
        efficiency: totalDaysOff / 1,
        includes,
        isCompanyVacation: false,
        type: "long-weekend" as const,
        month,
      };
      potentialPeriods.push({
        ...potentialPeriodBase,
        score: calculateScore(potentialPeriodBase, remoteWorkdayDates),
      });
    }

    if (dayOfWeek === 4) {
      const friday = addDays(day, 1);
      const fridayStr = friday.toISOString().split("T")[0];
      if (availableWorkdaysSet.has(fridayStr)) {
        const vacationDays = [new Date(day), new Date(friday)];
        const periodStartDate = findPeriodStart(
          day,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        );
        const periodEndDate = findPeriodEnd(
          friday,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        );
        const totalDaysOff = calculateTotalDaysOffInclusive(
          periodStartDate,
          periodEndDate
        );
        const vacationDaysSet = new Set([dayStr, fridayStr]);
        const includes = getIncludedDaysInfo(
          periodStartDate,
          periodEndDate,
          holidays,
          workdayNumbers,
          companyVacationDates,
          vacationDaysSet
        );
        const month = day.getUTCMonth();
        const potentialPeriodBase = {
          startDate: periodStartDate,
          endDate: periodEndDate,
          vacationDays,
          totalDays: totalDaysOff,
          efficiency: totalDaysOff / 2,
          includes,
          isCompanyVacation: false,
          type: "long-weekend" as const,
          month,
        };
        potentialPeriods.push({
          ...potentialPeriodBase,
          score: calculateScore(potentialPeriodBase, remoteWorkdayDates),
        });
      }
    }

    if (dayOfWeek === 2) {
      const monday = addDays(day, -1);
      const mondayStr = monday.toISOString().split("T")[0];
      if (availableWorkdaysSet.has(mondayStr)) {
        const vacationDays = [new Date(monday), new Date(day)];
        const periodStartDate = findPeriodStart(
          monday,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        );
        const periodEndDate = findPeriodEnd(
          day,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        );
        const totalDaysOff = calculateTotalDaysOffInclusive(
          periodStartDate,
          periodEndDate
        );
        const vacationDaysSet = new Set([mondayStr, dayStr]);
        const includes = getIncludedDaysInfo(
          periodStartDate,
          periodEndDate,
          holidays,
          workdayNumbers,
          companyVacationDates,
          vacationDaysSet
        );
        const month = monday.getUTCMonth();
        const potentialPeriodBase = {
          startDate: periodStartDate,
          endDate: periodEndDate,
          vacationDays,
          totalDays: totalDaysOff,
          efficiency: totalDaysOff / 2,
          includes,
          isCompanyVacation: false,
          type: "long-weekend" as const,
          month,
        };
        potentialPeriods.push({
          ...potentialPeriodBase,
          score: calculateScore(potentialPeriodBase, remoteWorkdayDates),
        });
      }
    }
  }

  const uniquePeriodsMap = new Map<string, PotentialPeriod>();
  potentialPeriods.forEach((p) => {
    const key = p.vacationDays
      .map((d) => d.toISOString().split("T")[0])
      .sort()
      .join(",");
    if (
      !uniquePeriodsMap.has(key) ||
      p.score > (uniquePeriodsMap.get(key)?.score ?? -Infinity)
    ) {
      uniquePeriodsMap.set(key, p);
    }
  });

  return Array.from(uniquePeriodsMap.values());
}

// --- Generate Potential Holiday Bridge Periods ---
// New function to bridge between two holidays
function generatePotentialHolidayBridgePeriods(
  availableWorkdays: Date[],
  holidays: Holiday[],
  holidayDates: Set<string>,
  workdayNumbers: number[],
  companyVacationDates: Set<string>,
  remoteWorkdayDates: Set<string>,
  maxDaysBetweenHolidays: number = 15 // Max workdays between holidays to consider
): PotentialPeriod[] {
  const potentialPeriods: PotentialPeriod[] = [];

  // Filter out remote days from available workdays
  const nonRemoteWorkdays = availableWorkdays.filter((day) => {
    const dayStr = day.toISOString().split("T")[0];
    return !remoteWorkdayDates.has(dayStr);
  });
  const availableWorkdaysSet = new Set(
    nonRemoteWorkdays.map((d) => d.toISOString().split("T")[0])
  );

  // console.log(
  //   `[Holiday Bridge Generator] Filtering remote days: Original workdays: ${availableWorkdays.length}, After filtering: ${nonRemoteWorkdays.length}`
  // );

  // Sort holidays by date
  const sortedHolidays = [...holidays].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  for (let i = 0; i < sortedHolidays.length - 1; i++) {
    const holiday1 = sortedHolidays[i];
    for (let j = i + 1; j < sortedHolidays.length; j++) {
      const holiday2 = sortedHolidays[j];

      const vacationDays: Date[] = [];
      let possible = true;
      const currentDay = addDays(holiday1.date, 1);
      const lastDayBeforeH2 = addDays(holiday2.date, -1);

      // Optimization: if holiday2 is too far, break inner loop
      const dayDiff =
        (lastDayBeforeH2.getTime() - currentDay.getTime()) /
        (1000 * 60 * 60 * 24);
      if (dayDiff >= maxDaysBetweenHolidays) {
        // Assuming roughly 5/7 workdays, check if the total days exceed a larger threshold
        if (dayDiff * (5 / 7) > maxDaysBetweenHolidays) {
          // console.log(`[Holiday Bridge] Skipping pair ${holiday1.date.toISOString().split("T")[0]} - ${holiday2.date.toISOString().split("T")[0]} (too far)`);
          break; // Break inner loop if holidays are too far apart
        }
      }

      while (currentDay <= lastDayBeforeH2) {
        const currentDayStr = currentDay.toISOString().split("T")[0];
        if (isWorkday(currentDay, workdayNumbers)) {
          // Check if this workday is available for vacation
          if (
            !availableWorkdaysSet.has(currentDayStr) ||
            companyVacationDates.has(currentDayStr)
          ) {
            possible = false;
            // console.log(`[Holiday Bridge] Skipping pair ${holiday1.date.toISOString().split("T")[0]} - ${holiday2.date.toISOString().split("T")[0]} (unavailable day: ${currentDayStr})`);
            break; // Stop checking days for this pair
          }
          vacationDays.push(new Date(currentDay));
        }
        currentDay.setUTCDate(currentDay.getUTCDate() + 1);
      }

      // If a bridge is possible and uses > 0 days, and within the max limit
      if (
        possible &&
        vacationDays.length > 0 &&
        vacationDays.length <= maxDaysBetweenHolidays
      ) {
        const periodStartDate = findPeriodStart(
          vacationDays[0],
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        );
        const periodEndDate = findPeriodEnd(
          vacationDays[vacationDays.length - 1],
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        );
        const totalDaysOff = calculateTotalDaysOffInclusive(
          periodStartDate,
          periodEndDate
        );
        const vacationDaysSet = new Set(
          vacationDays.map((d) => d.toISOString().split("T")[0])
        );
        const includes = getIncludedDaysInfo(
          periodStartDate,
          periodEndDate,
          holidays, // Pass all holidays for inclusion check
          workdayNumbers,
          companyVacationDates,
          vacationDaysSet
        );
        const month = vacationDays[0].getUTCMonth();

        const potentialPeriodBase = {
          startDate: periodStartDate,
          endDate: periodEndDate,
          vacationDays,
          totalDays: totalDaysOff,
          efficiency: totalDaysOff / vacationDays.length,
          includes,
          isCompanyVacation: false,
          type: "holiday-bridge" as const,
          month,
        };

        potentialPeriods.push({
          ...potentialPeriodBase,
          score: calculateScore(potentialPeriodBase, remoteWorkdayDates),
        });
        // console.log(`[Holiday Bridge] Found potential bridge: ${vacationDays.map(d => d.toISOString().split('T')[0]).join(', ')}`);
      }
    }
  }

  // Deduplicate based on vacation days string
  const uniquePeriodsMap = new Map<string, PotentialPeriod>();
  potentialPeriods.forEach((p) => {
    const key = p.vacationDays
      .map((d) => d.toISOString().split("T")[0])
      .sort()
      .join(",");
    if (
      !uniquePeriodsMap.has(key) ||
      p.score > (uniquePeriodsMap.get(key)?.score ?? -Infinity)
    ) {
      uniquePeriodsMap.set(key, p);
    }
  });

  return Array.from(uniquePeriodsMap.values());
}

// --- Main Optimizer Function ---
export function findOptimalVacationPeriods(
  workdays: Date[],
  remainingVacationDays: number,
  holidays: Holiday[],
  workdayNumbers: number[],
  _holidaysByMonth: { [month: number]: Holiday[] },
  remoteWorkdays: number[] = [],
  companyVacationDays: Date[] = [],
  remoteWorkdayDateStrings: Set<string> = new Set()
): PotentialPeriod[] {
  // Store selected periods internally as PotentialPeriod, clean up before return
  const selectedPotentialPeriods: PotentialPeriod[] = [];
  let vacationDaysLeft = remainingVacationDays;

  const companyVacationDateStrings = new Set(
    companyVacationDays.map((d) => d.toISOString().split("T")[0])
  );
  const holidayDateStrings = new Set(
    holidays.map((h) => h.date.toISOString().split("T")[0])
  );

  console.log(
    `[PeriodStrategies] Received ${remoteWorkdayDateStrings.size} remote workday dates for scoring.`
  );

  const availableWorkdaysForVacation = workdays.filter((day: Date) => {
    const dateStr = day.toISOString().split("T")[0];
    const isHoliday = holidayDateStrings.has(dateStr);
    const isCompanyDay = companyVacationDateStrings.has(dateStr);
    const isRemote = remoteWorkdayDateStrings.has(dateStr);
    return !isHoliday && !isCompanyDay && !isRemote;
  });
  console.log(
    `[Optimizer] Workdays available for planning vacation: ${availableWorkdaysForVacation.length}`
  );

  if (availableWorkdaysForVacation.length === 0) {
    console.warn("[Optimizer] No available workdays for vacation planning.");
    return [];
  }

  console.log("[Optimizer] Generating potential bridge periods...");
  const potentialBridges = generatePotentialBridgePeriods(
    availableWorkdaysForVacation,
    holidays,
    holidayDateStrings,
    workdayNumbers,
    companyVacationDateStrings,
    remoteWorkdayDateStrings
  );
  console.log(
    `[Optimizer] Found ${potentialBridges.length} potential bridge periods.`
  );

  console.log("[Optimizer] Generating potential holiday link periods...");
  const potentialHolidayLinks = generatePotentialHolidayLinkPeriods(
    availableWorkdaysForVacation,
    holidays,
    holidayDateStrings,
    workdayNumbers,
    companyVacationDateStrings,
    remoteWorkdayDateStrings
  );
  console.log(
    `[Optimizer] Found ${potentialHolidayLinks.length} potential holiday link periods.`
  );

  console.log("[Optimizer] Generating potential long weekend periods...");
  const potentialLongWeekends = generatePotentialLongWeekendPeriods(
    availableWorkdaysForVacation,
    holidays,
    holidayDateStrings,
    workdayNumbers,
    companyVacationDateStrings,
    remoteWorkdayDateStrings
  );
  console.log(
    `[Optimizer] Found ${potentialLongWeekends.length} potential long weekend periods.`
  );

  // --- NEW: Generate Holiday Bridge Periods ---
  console.log("[Optimizer] Generating potential holiday bridge periods...");
  const potentialHolidayBridges = generatePotentialHolidayBridgePeriods(
    availableWorkdaysForVacation,
    holidays, // Pass relevant holidays used for calculation
    holidayDateStrings,
    workdayNumbers,
    companyVacationDateStrings,
    remoteWorkdayDateStrings
  );
  console.log(
    `[Optimizer] Found ${potentialHolidayBridges.length} potential holiday bridge periods.`
  );
  // --- END NEW ---

  let allPotentialPeriods: PotentialPeriod[] = [
    ...potentialBridges,
    ...potentialHolidayLinks,
    ...potentialLongWeekends,
    ...potentialHolidayBridges, // Add the new type
  ];

  // --- Deduplicate and Filter Invalid Periods ---
  const uniquePeriodsMap = new Map<string, PotentialPeriod>();
  allPotentialPeriods.forEach((p) => {
    // Basic validation
    if (
      !p ||
      p.score === -Infinity ||
      !p.vacationDays ||
      p.vacationDays.length === 0 ||
      !p.startDate ||
      !p.endDate ||
      p.startDate > p.endDate
    ) {
      // console.log(`[Optimizer] Filtering out invalid period: Score: ${p?.score}, VacDays: ${p?.vacationDays?.length}`);
      return;
    }
    const key = p.vacationDays
      .map((d) => d.toISOString().split("T")[0])
      .sort()
      .join(",");
    if (
      !uniquePeriodsMap.has(key) ||
      p.score > (uniquePeriodsMap.get(key)?.score ?? -Infinity)
    ) {
      uniquePeriodsMap.set(key, p);
    }
  });
  allPotentialPeriods = Array.from(uniquePeriodsMap.values());
  console.log(
    `[Optimizer] Total unique valid potential periods after merge: ${allPotentialPeriods.length}`
  );

  // --- Filter Next Year Periods (Optional) ---
  const currentYear = availableWorkdaysForVacation[0]?.getUTCFullYear();
  let periodsToConsider = allPotentialPeriods;

  // Filter out periods with vacation days in the next year when possible
  // Only do this if we have enough options in the current year
  const currentYearPeriods = periodsToConsider.filter((period) => {
    return !period.vacationDays.some(
      (day) => day.getUTCFullYear() > currentYear
    );
  });

  // Only use current year periods if we have enough options
  if (
    currentYearPeriods.length < periodsToConsider.length &&
    currentYearPeriods.length >= Math.max(10, remainingVacationDays * 1.5)
  ) {
    periodsToConsider = currentYearPeriods;
    console.log(
      `[Optimizer] Filtered out ${
        periodsToConsider.length - currentYearPeriods.length
      } periods with next-year vacation days.`
    );
    console.log(
      `[Optimizer] Using ${
        periodsToConsider === currentYearPeriods
          ? "only current year"
          : "all available"
      } periods: ${periodsToConsider.length}`
    );
  } else if (currentYearPeriods.length < periodsToConsider.length) {
    console.log(
      `[Optimizer] Not filtering next-year periods. Only ${currentYearPeriods.length} current year options found (budget: ${remainingVacationDays}). Using all ${periodsToConsider.length} periods.`
    );
  } else {
    console.warn(
      "[Optimizer] Could not determine current year from available workdays."
    );
  }

  // --- Sort by Score ---
  periodsToConsider.sort((a, b) => b.score - a.score);

  console.log(
    "[Optimizer] Top 15 potential periods by score (after filtering):"
  );
  periodsToConsider.slice(0, 15).forEach((p, index) => {
    console.log(
      `  ${index + 1}. Score: ${p.score.toFixed(2)}, Type: ${
        p.type
      }, VacDays: ${p.vacationDays.length}, TotalDays: ${p.totalDays}, Start: ${
        p.startDate.toISOString().split("T")[0]
      }, End: ${p.endDate.toISOString().split("T")[0]}, Vac: ${p.vacationDays
        .map((d) => d.toISOString().split("T")[0])
        .join(", ")}`
    );
  });

  console.log(`[Optimizer] Selecting periods with budget: ${vacationDaysLeft}`);

  for (const period of periodsToConsider) {
    if (vacationDaysLeft <= 0) {
      break;
    }

    // Skip periods with low scores to avoid wasting vacation days on poor options
    if (period.score < MIN_SCORE_THRESHOLD) {
      console.log(
        `[Optimizer] Stopping selection: remaining periods score below threshold (${MIN_SCORE_THRESHOLD}). Score: ${period.score.toFixed(
          2
        )}`
      );
      break;
    }

    const periodCost = period.vacationDays.length;

    if (periodCost > 0 && periodCost <= vacationDaysLeft) {
      // --- Reverted Overlap Check ---
      // Check ONLY if the specific VACATION days overlap with existing selections.
      const newVacationDaysOverlap = doVacationDaysOverlap(
        period.vacationDays,
        selectedPotentialPeriods
      );
      // --- END Reverted Check ---

      if (!newVacationDaysOverlap) {
        selectedPotentialPeriods.push(period);
        vacationDaysLeft -= periodCost;

        console.log(
          `[Optimizer] Selected Period: Start=${
            period.startDate.toISOString().split("T")[0]
          }, VacDays=${
            period.vacationDays.length
          }, Cost=${periodCost}, Score=${period.score.toFixed(2)}, Type=${
            period.type
          }. Budget Left: ${vacationDaysLeft}`
        );
      } else {
        // Optional: Log why a period was skipped due to overlap
        console.log(
          `[Optimizer] Skipped Period (Overlap): Start=${
            period.startDate.toISOString().split("T")[0]
          }, VacDays=${period.vacationDays
            .map((d) => d.toISOString().split("T")[0])
            .join(",")}, Score=${period.score.toFixed(2)}`
        );
      }
    }
  }

  // --- Final Sort and Cleanup ---
  selectedPotentialPeriods.sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  );

  console.log(
    `[Optimizer] Final selected periods: ${selectedPotentialPeriods.length}`
  );
  console.log(
    `[Optimizer] Remaining budget after selection: ${vacationDaysLeft}`
  );

  return selectedPotentialPeriods;
}
