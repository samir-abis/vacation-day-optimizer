import { Holiday } from "./holidays";
import { VacationPeriod } from "./types";
import {
  addDays,
  isValidDate,
  isWorkday,
  calculateTotalDaysOffInclusive,
  isRemoteDay,
  isDateInPeriods,
} from "./date-utils";

// --- Helper function to find the true start of an off-period ---
export function findPeriodStart(
  vacationStartDate: Date,
  workdayNumbers: number[],
  holidayDates: Set<string>,
  companyVacationDates: Set<string>
): Date {
  // Validate input date
  if (!isValidDate(vacationStartDate)) {
    console.error(
      "Invalid vacationStartDate passed to findPeriodStart:",
      vacationStartDate
    );
    // Return the invalid date or throw an error, depending on desired handling
    return vacationStartDate; // Or potentially throw new Error(...)
  }

  let current = new Date(vacationStartDate);
  let iterations = 0; // Safety counter
  const maxIterations = 30;

  while (iterations < maxIterations) {
    const dayBefore = addDays(current, -1);

    // Validate the calculated date before using it
    if (!isValidDate(dayBefore)) {
      console.error(
        "Invalid date calculated in findPeriodStart (dayBefore):",
        dayBefore,
        " from current:",
        current
      );
      break; // Stop the loop if an invalid date is produced
    }

    const dayBeforeStr = dayBefore.toISOString().split("T")[0];
    if (
      isWorkday(dayBefore, workdayNumbers) &&
      !holidayDates.has(dayBeforeStr) &&
      !companyVacationDates.has(dayBeforeStr)
    ) {
      // The day before is a working day, so 'current' is the true start
      break;
    }
    current = dayBefore;
    iterations++;
  }

  if (iterations === maxIterations) {
    console.warn(
      "findPeriodStart reached max iterations for date:",
      vacationStartDate
    );
  }

  return current;
}

// --- Helper function to find the true end of an off-period ---
export function findPeriodEnd(
  vacationEndDate: Date,
  workdayNumbers: number[],
  holidayDates: Set<string>,
  companyVacationDates: Set<string>
): Date {
  // Validate input date
  if (!isValidDate(vacationEndDate)) {
    console.error(
      "Invalid vacationEndDate passed to findPeriodEnd:",
      vacationEndDate
    );
    return vacationEndDate;
  }

  let current = new Date(vacationEndDate);
  let iterations = 0; // Safety counter
  const maxIterations = 30;

  while (iterations < maxIterations) {
    const dayAfter = addDays(current, 1);

    // Validate the calculated date before using it
    if (!isValidDate(dayAfter)) {
      console.error(
        "Invalid date calculated in findPeriodEnd (dayAfter):",
        dayAfter,
        " from current:",
        current
      );
      break; // Stop the loop if an invalid date is produced
    }

    const dayAfterStr = dayAfter.toISOString().split("T")[0];
    if (
      isWorkday(dayAfter, workdayNumbers) &&
      !holidayDates.has(dayAfterStr) &&
      !companyVacationDates.has(dayAfterStr)
    ) {
      // The day after is a working day, so 'current' is the true end
      break;
    }
    current = dayAfter;
    iterations++;
  }

  if (iterations === maxIterations) {
    console.warn(
      "findPeriodEnd reached max iterations for date:",
      vacationEndDate
    );
  }

  return current;
}

export function isConsecutiveWorkday(
  day1: Date,
  day2: Date,
  workdayNumbers: number[],
  holidayDates: Set<string>,
  companyVacationDates: Set<string>
): boolean {
  let current = addDays(day1, 1);
  const end = new Date(day2);
  end.setHours(0, 0, 0, 0);

  while (current < end) {
    const currentStr = current.toISOString().split("T")[0];
    if (
      isWorkday(current, workdayNumbers) &&
      !holidayDates.has(currentStr) &&
      !companyVacationDates.has(currentStr)
    ) {
      return false;
    }
    current = addDays(current, 1);
  }
  return true;
}

export function findBridgeDays(
  availableWorkdays: Date[],
  holidays: Holiday[],
  holidayDates: Set<string>,
  workdayNumbers: number[],
  maxDays: number,
  _remoteWorkdays: number[] = [],
  companyVacationDates: Set<string>
): VacationPeriod[] {
  const potentialPeriods: VacationPeriod[] = [];

  for (let i = 0; i < availableWorkdays.length; i++) {
    const currentDay = availableWorkdays[i];
    const currentDayStr = currentDay.toISOString().split("T")[0];

    if (companyVacationDates.has(currentDayStr)) {
      continue;
    }

    const dayBefore = addDays(currentDay, -1);
    const dayAfter = addDays(currentDay, 1);
    const dayBeforeStr = dayBefore.toISOString().split("T")[0];
    const dayAfterStr = dayAfter.toISOString().split("T")[0];

    const isBeforeWeekendOrHoliday =
      !isWorkday(dayAfter, workdayNumbers) ||
      holidayDates.has(dayAfterStr) ||
      companyVacationDates.has(dayAfterStr);

    const isAfterWeekendOrHoliday =
      !isWorkday(dayBefore, workdayNumbers) ||
      holidayDates.has(dayBeforeStr) ||
      companyVacationDates.has(dayBeforeStr);

    if (isBeforeWeekendOrHoliday || isAfterWeekendOrHoliday) {
      const vacationDays = [new Date(currentDay)];
      let endDate = new Date(currentDay);

      let j = i + 1;
      while (
        j < availableWorkdays.length &&
        vacationDays.length < 4 &&
        isConsecutiveWorkday(
          availableWorkdays[j - 1],
          availableWorkdays[j],
          workdayNumbers,
          holidayDates,
          companyVacationDates
        )
      ) {
        const nextDay = availableWorkdays[j];
        const nextDayStr = nextDay.toISOString().split("T")[0];

        if (companyVacationDates.has(nextDayStr)) {
          break;
        }

        const nextDayAfter = addDays(nextDay, 1);
        const nextDayAfterStr = nextDayAfter.toISOString().split("T")[0];

        const isNextDayBridge =
          !isWorkday(nextDayAfter, workdayNumbers) ||
          holidayDates.has(nextDayAfterStr) ||
          companyVacationDates.has(nextDayAfterStr);

        if (isNextDayBridge) {
          vacationDays.push(new Date(nextDay));
          endDate = new Date(nextDay);
        } else {
          break;
        }
        j++;
      }

      const periodStartDate = findPeriodStart(
        vacationDays[0],
        workdayNumbers,
        holidayDates,
        companyVacationDates
      );
      const periodEndDate = findPeriodEnd(
        endDate,
        workdayNumbers,
        holidayDates,
        companyVacationDates
      );
      const totalDaysOff = calculateTotalDaysOffInclusive(
        periodStartDate,
        periodEndDate
      );
      const efficiency = totalDaysOff / vacationDays.length;
      const includes = getIncludedDaysInfo(
        periodStartDate,
        periodEndDate,
        holidays,
        workdayNumbers,
        companyVacationDates
      );

      potentialPeriods.push({
        startDate: periodStartDate,
        endDate: periodEndDate,
        vacationDays,
        totalDays: totalDaysOff,
        efficiency,
        includes,
      });
    }
  }

  potentialPeriods.sort((a, b) => {
    const effA = Number.isFinite(a.efficiency)
      ? a.efficiency ?? -Infinity
      : -Infinity;
    const effB = Number.isFinite(b.efficiency)
      ? b.efficiency ?? -Infinity
      : -Infinity;

    if (effB !== effA) {
      return effB - effA;
    }
    return a.startDate.getTime() - b.startDate.getTime();
  });

  const finalPeriods: VacationPeriod[] = [];
  const selectedVacationDays = new Set<string>();
  let daysUsed = 0;

  for (const period of potentialPeriods) {
    const periodVacationDays = period.vacationDays.map(
      (d) => d.toISOString().split("T")[0]
    );
    const overlaps = periodVacationDays.some((d) =>
      selectedVacationDays.has(d)
    );
    const exceedsMax = daysUsed + period.vacationDays.length > maxDays;

    if (!overlaps && !exceedsMax) {
      finalPeriods.push(period);
      periodVacationDays.forEach((d) => selectedVacationDays.add(d));
      daysUsed += period.vacationDays.length;
    }
  }

  return finalPeriods;
}

export function distributeRemainingDays(
  availableWorkdays: Date[],
  remainingDays: number,
  holidays: Holiday[],
  holidayDates: Set<string>,
  workdayNumbers: number[],
  holidaysByMonth: { [month: number]: Holiday[] },
  existingPeriods: VacationPeriod[],
  _remoteWorkdays: number[] = [],
  companyVacationDates: Set<string>
): VacationPeriod[] {
  const periods: VacationPeriod[] = [];
  let daysLeft = remainingDays;

  const monthsWithHolidays = Object.keys(holidaysByMonth)
    .map(Number)
    .sort((a, b) => a - b);

  for (const month of monthsWithHolidays) {
    if (daysLeft <= 0) break;

    const monthHolidays = holidaysByMonth[month];
    if (!monthHolidays || monthHolidays.length === 0) continue;

    const monthWorkdays = availableWorkdays.filter(
      (day: Date) => day.getUTCMonth() === month
    );
    if (monthWorkdays.length === 0) continue;

    monthHolidays.sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const holiday of monthHolidays) {
      if (daysLeft <= 0) break;

      const holidayDate = holiday.date;

      const holidayTime = holidayDate.getTime();
      const nearbyWorkdays: Date[] = [];
      const maxDiff = 3 * 24 * 60 * 60 * 1000;

      for (const workday of monthWorkdays) {
        const diff = Math.abs(workday.getTime() - holidayTime);
        if (diff <= maxDiff) {
          const workdayStr = workday.toISOString().split("T")[0];
          if (
            !isDateInPeriods(workday, existingPeriods) &&
            !companyVacationDates.has(workdayStr)
          ) {
            nearbyWorkdays.push(workday);
          }
        }
      }

      if (nearbyWorkdays.length === 0) continue;

      // Revert to sorting only by proximity to the holiday
      nearbyWorkdays.sort((a: Date, b: Date) => {
        const diffA = Math.abs(a.getTime() - holidayTime);
        const diffB = Math.abs(b.getTime() - holidayTime);
        if (diffA !== diffB) {
          return diffA - diffB;
        }
        return a.getTime() - b.getTime(); // Tie-break with earlier date
      });

      // Double-check nearbyWorkdays still has elements after filtering and sorting
      if (nearbyWorkdays.length === 0) continue;

      // Use Math.floor on daysLeft to ensure we only take whole days
      const daysToTake = Math.min(
        Math.floor(daysLeft),
        nearbyWorkdays.length,
        2
      );

      if (daysToTake <= 0) continue; // Skip if we can't take any days

      const selectedDays = nearbyWorkdays.slice(0, daysToTake);

      // Safety check - shouldn't be needed but prevents crash
      if (selectedDays.length === 0) {
        console.error(
          "Logic error: selectedDays is empty despite daysToTake > 0 in distributeRemainingDays",
          {
            daysToTake,
            nearbyWorkdaysLength: nearbyWorkdays.length,
            holiday: holiday.name,
            holidayDate: holiday.date.toISOString(),
          }
        );
        continue; // Skip this iteration
      }

      selectedDays.sort((a: Date, b: Date) => a.getTime() - b.getTime());

      const startDate = selectedDays[0];
      const endDate = selectedDays[selectedDays.length - 1];

      if (!isValidDate(startDate)) {
        console.error(
          "Invalid startDate generated in distributeRemainingDays:",
          startDate,
          "from selectedDays:",
          selectedDays
        );
        continue; // Skip this holiday if start date is invalid
      }
      if (!isValidDate(endDate)) {
        console.error(
          "Invalid endDate generated in distributeRemainingDays:",
          endDate,
          "from selectedDays:",
          selectedDays
        );
        continue; // Skip this holiday if end date is invalid
      }

      // Find the actual start/end of the off-period
      const periodStartDate = findPeriodStart(
        startDate,
        workdayNumbers,
        holidayDates,
        companyVacationDates
      );
      const periodEndDate = findPeriodEnd(
        endDate,
        workdayNumbers,
        holidayDates,
        companyVacationDates
      );

      const totalDays = calculateTotalDaysOffInclusive(
        periodStartDate,
        periodEndDate
      );

      const newPeriod: VacationPeriod = {
        startDate: periodStartDate,
        endDate: periodEndDate,
        vacationDays: selectedDays,
        totalDays: totalDays,
        includes: getIncludedDaysInfo(
          periodStartDate,
          periodEndDate,
          holidays,
          workdayNumbers,
          companyVacationDates
        ),
        isCompanyVacation: false,
      };

      if (
        !doPeriodsOverlap(newPeriod, existingPeriods) &&
        !doPeriodsOverlap(newPeriod, periods)
      ) {
        periods.push(newPeriod);
        daysLeft -= selectedDays.length;
      }
    }
  }

  periods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return periods;
}

export function createLongWeekends(
  availableWorkdays: Date[],
  remainingDays: number,
  workdayNumbers: number[],
  existingPeriods: VacationPeriod[],
  remoteWorkdays: number[] = [],
  companyVacationDates: Set<string>
): VacationPeriod[] {
  const periods: VacationPeriod[] = [];
  let daysLeft = remainingDays;

  const potentialFridays = availableWorkdays.filter(
    (day: Date) =>
      day.getUTCDay() === 5 &&
      !isDateInPeriods(day, existingPeriods) &&
      !companyVacationDates.has(day.toISOString().split("T")[0])
  );
  // Remove sorting by remote status
  potentialFridays.sort((a, b) => a.getTime() - b.getTime()); // Simple sort by date

  const potentialMondays = availableWorkdays.filter(
    (day: Date) =>
      day.getUTCDay() === 1 &&
      !isDateInPeriods(day, existingPeriods) &&
      !companyVacationDates.has(day.toISOString().split("T")[0])
  );
  // Remove sorting by remote status
  potentialMondays.sort((a, b) => a.getTime() - b.getTime()); // Simple sort by date

  let fridayIndex = 0;
  let mondayIndex = 0;

  while (
    daysLeft > 0 &&
    (fridayIndex < potentialFridays.length ||
      mondayIndex < potentialMondays.length)
  ) {
    if (daysLeft > 0 && fridayIndex < potentialFridays.length) {
      const friday = potentialFridays[fridayIndex++];
      if (!isDateInPeriods(friday, periods)) {
        const startDate = new Date(friday);
        const endDate = new Date(friday);
        const vacationDays = [new Date(friday)];
        const weekendStart = new Date(friday);
        const weekendEnd = addDays(friday, 2);

        periods.push({
          startDate,
          endDate,
          vacationDays,
          totalDays: 3,
          includes: getIncludedDaysInfo(
            weekendStart,
            weekendEnd,
            [],
            workdayNumbers,
            companyVacationDates
          ),
          isCompanyVacation: false,
        });
        daysLeft--;
      }
    }

    if (daysLeft > 0 && mondayIndex < potentialMondays.length) {
      const monday = potentialMondays[mondayIndex++];
      if (!isDateInPeriods(monday, periods)) {
        const startDate = new Date(monday);
        const endDate = new Date(monday);
        const vacationDays = [new Date(monday)];
        const weekendStart = addDays(monday, -2);
        const weekendEnd = new Date(monday);

        periods.push({
          startDate,
          endDate,
          vacationDays,
          totalDays: 3,
          includes: getIncludedDaysInfo(
            weekendStart,
            weekendEnd,
            [],
            workdayNumbers,
            companyVacationDates
          ),
          isCompanyVacation: false,
        });
        daysLeft--;
      }
    }
  }

  if (daysLeft > 0) {
    const potentialThursdays = availableWorkdays.filter(
      (day: Date) =>
        day.getUTCDay() === 4 &&
        !isDateInPeriods(day, existingPeriods) &&
        !isDateInPeriods(day, periods) &&
        !companyVacationDates.has(day.toISOString().split("T")[0])
    );
    // Remove sorting by remote status
    potentialThursdays.sort((a, b) => a.getTime() - b.getTime()); // Simple sort by date

    const potentialTuesdays = availableWorkdays.filter(
      (day: Date) =>
        day.getUTCDay() === 2 &&
        !isDateInPeriods(day, existingPeriods) &&
        !isDateInPeriods(day, periods) &&
        !companyVacationDates.has(day.toISOString().split("T")[0])
    );
    // Remove sorting by remote status
    potentialTuesdays.sort((a, b) => a.getTime() - b.getTime()); // Simple sort by date

    const isAdjDayAvailable = (adjDay: Date): boolean => {
      const adjDayStr = adjDay.toISOString().split("T")[0];
      return (
        isWorkday(adjDay, workdayNumbers) &&
        !isRemoteDay(adjDay, remoteWorkdays) &&
        !companyVacationDates.has(adjDayStr) &&
        !isDateInPeriods(adjDay, existingPeriods) &&
        !isDateInPeriods(adjDay, periods)
      );
    };

    let thursIndex = 0;
    while (daysLeft > 1 && thursIndex < potentialThursdays.length) {
      const thursday = potentialThursdays[thursIndex++];
      const friday = addDays(thursday, 1);
      if (isAdjDayAvailable(friday)) {
        const startDate = new Date(thursday);
        const endDate = new Date(friday);
        const vacationDays = [new Date(thursday), new Date(friday)];
        const weekendStart = new Date(thursday);
        const weekendEnd = addDays(friday, 2);

        periods.push({
          startDate,
          endDate,
          vacationDays,
          totalDays: 4,
          includes: getIncludedDaysInfo(
            weekendStart,
            weekendEnd,
            [],
            workdayNumbers,
            companyVacationDates
          ),
          isCompanyVacation: false,
        });
        daysLeft -= 2;
      }
    }

    let tuesIndex = 0;
    while (daysLeft > 1 && tuesIndex < potentialTuesdays.length) {
      const tuesday = potentialTuesdays[tuesIndex++];
      const monday = addDays(tuesday, -1);
      if (isAdjDayAvailable(monday)) {
        const startDate = new Date(monday);
        const endDate = new Date(tuesday);
        const vacationDays = [new Date(monday), new Date(tuesday)];
        const weekendStart = addDays(monday, -2);
        const weekendEnd = new Date(tuesday);

        periods.push({
          startDate,
          endDate,
          vacationDays,
          totalDays: 4,
          includes: getIncludedDaysInfo(
            weekendStart,
            weekendEnd,
            [],
            workdayNumbers,
            companyVacationDates
          ),
          isCompanyVacation: false,
        });
        daysLeft -= 2;
      }
    }
  }

  periods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return periods;
}

// Helper function to check for overlaps, considering vacation days precisely
function doPeriodsOverlap(
  newPeriod: VacationPeriod,
  existingPeriods: VacationPeriod[]
): boolean {
  const newStart = newPeriod.startDate.getTime();
  const newEnd = newPeriod.endDate.getTime();

  for (const existing of existingPeriods) {
    const existingStart = existing.startDate.getTime();
    const existingEnd = existing.endDate.getTime();

    if (newStart <= existingEnd && newEnd >= existingStart) {
      const newVacationDates = new Set(
        newPeriod.vacationDays.map((d) => d.toISOString().split("T")[0])
      );
      for (const existingVD of existing.vacationDays) {
        if (newVacationDates.has(existingVD.toISOString().split("T")[0])) {
          return true;
        }
      }
    }
  }
  return false;
}

function getIncludedDaysInfo(
  periodStartDate: Date,
  periodEndDate: Date,
  holidays: Holiday[],
  workdayNumbers: number[],
  companyVacationDates: Set<string>
): { type: string; name?: string }[] {
  const includes: { type: string; name?: string }[] = [];
  const holidayMap = new Map<string, string>();
  holidays.forEach((h) =>
    holidayMap.set(h.date.toISOString().split("T")[0], h.name)
  );

  let hasWeekend = false;
  const currentDate = new Date(periodStartDate);
  const end = new Date(periodEndDate);

  while (currentDate <= end) {
    const currentDayStr = currentDate.toISOString().split("T")[0];
    const dayOfWeek = currentDate.getUTCDay();

    if (!workdayNumbers.includes(dayOfWeek) && !hasWeekend) {
      includes.push({ type: "weekend" });
      hasWeekend = true;
    }

    if (holidayMap.has(currentDayStr)) {
      includes.push({
        type: "holiday",
        name: holidayMap.get(currentDayStr),
      });
    }

    if (companyVacationDates.has(currentDayStr)) {
      includes.push({
        type: "company",
        name: "Company Vacation",
      });
    }

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  const uniqueIncludes = Array.from(
    new Map(includes.map((item) => [JSON.stringify(item), item])).values()
  );

  return uniqueIncludes;
}

export function findOptimalVacationPeriods(
  workdays: Date[],
  remainingVacationDays: number,
  holidays: Holiday[],
  workdayNumbers: number[],
  holidaysByMonth: { [month: number]: Holiday[] },
  remoteWorkdays: number[] = [],
  companyVacationDays: Date[] = []
): VacationPeriod[] {
  const periods: VacationPeriod[] = [];
  let vacationDaysLeft = remainingVacationDays;

  const companyVacationDateStrings = new Set(
    companyVacationDays.map((d) => d.toISOString().split("T")[0])
  );
  const holidayDateStrings = new Set(
    holidays.map((h) => h.date.toISOString().split("T")[0])
  );

  // Filter available workdays: exclude company vacation days always,
  // and exclude remote days IF remoteWorkdays array is not empty (toggle is on)
  const shouldExcludeRemote = remoteWorkdays.length > 0;
  const availableWorkdaysForVacation = workdays.filter((day: Date) => {
    const dateStr = day.toISOString().split("T")[0];
    const isCompanyDay = companyVacationDateStrings.has(dateStr);
    const isRemote = shouldExcludeRemote && isRemoteDay(day, remoteWorkdays);
    return !isCompanyDay && !isRemote;
  });

  availableWorkdaysForVacation.sort(
    (a: Date, b: Date) => a.getTime() - b.getTime()
  );

  const bridgePeriods = findBridgeDays(
    availableWorkdaysForVacation,
    holidays,
    holidayDateStrings,
    workdayNumbers,
    vacationDaysLeft,
    remoteWorkdays,
    companyVacationDateStrings
  );

  for (const period of bridgePeriods) {
    if (
      vacationDaysLeft >= period.vacationDays.length &&
      !doPeriodsOverlap(period, periods)
    ) {
      periods.push(period);
      vacationDaysLeft -= period.vacationDays.length;
    }
  }

  periods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  if (vacationDaysLeft > 0) {
    const distributedPeriods = distributeRemainingDays(
      availableWorkdaysForVacation,
      vacationDaysLeft,
      holidays,
      holidayDateStrings,
      workdayNumbers,
      holidaysByMonth,
      periods,
      remoteWorkdays,
      companyVacationDateStrings
    );

    for (const period of distributedPeriods) {
      if (
        vacationDaysLeft >= period.vacationDays.length &&
        !doPeriodsOverlap(period, periods)
      ) {
        periods.push(period);
        vacationDaysLeft -= period.vacationDays.length;
      }
    }
    periods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  if (vacationDaysLeft > 0) {
    const longWeekends = createLongWeekends(
      availableWorkdaysForVacation,
      vacationDaysLeft,
      workdayNumbers,
      periods,
      remoteWorkdays,
      companyVacationDateStrings
    );

    for (const period of longWeekends) {
      const overlaps = period.vacationDays.some((vd) =>
        isDateInPeriods(vd, periods)
      );
      if (vacationDaysLeft >= period.vacationDays.length && !overlaps) {
        periods.push(period);
        vacationDaysLeft -= period.vacationDays.length;
      }
    }
    periods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  periods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  return periods;
}
