import { Holiday, getNationalHolidays, getRegionalHolidays } from "./holidays";

export interface VacationPeriod {
  startDate: Date;
  endDate: Date;
  vacationDays: Date[];
  totalDays: number;
  efficiency?: number;
  includes: { type: string; name?: string }[];
  isCompanyVacation?: boolean;
}

export interface CompanyVacationDay {
  date: string;
  duration: number;
}

export interface VacationPlan {
  recommendedDays: string[];
  totalDaysOff: number;
  remainingVacationDays: number;
  optimizerBudget: number;
  totalVacationDaysUsed: number;
  companyVacationDaysCost: number;
  vacationPeriods: {
    startDate: string;
    endDate: string;
    totalDays: number;
    vacationDaysUsed: number;
    includes: { type: string; name?: string }[];
    isCompanyVacation: boolean;
  }[];
  holidays: { date: string; name: string }[];
  remoteWorkdays: string[];
  companyVacationDays: string[];
}

export function calculateOptimalVacationDays(
  remainingVacationDays: number,
  workdays: number[],
  initialHolidays: Holiday[],
  year: number,
  remoteWorkdays: number[] = [],
  companyVacationDays: CompanyVacationDay[] = [],
  state: string | null = null
): VacationPlan {
  console.log("[Optimizer] Received remoteWorkdays:", remoteWorkdays);
  console.log(
    "[Optimizer] Received companyVacationDays (Input):",
    companyVacationDays
  );
  const today = new Date();
  const calculationEndDate = new Date(year + 1, 0, 15);

  const startDate = year === today.getFullYear() ? today : new Date(year, 0, 1);

  let allHolidays = [...initialHolidays];

  if (state) {
    allHolidays = allHolidays.concat(getRegionalHolidays(state, year));
  }

  const nextYearNationalHolidays = getNationalHolidays(year + 1);
  allHolidays = allHolidays.concat(nextYearNationalHolidays);

  if (state) {
    const nextYearRegionalHolidays = getRegionalHolidays(state, year + 1);
    allHolidays = allHolidays.concat(nextYearRegionalHolidays);
  }

  const uniqueHolidaysMap = new Map<string, Holiday>();
  allHolidays.forEach((h) =>
    uniqueHolidaysMap.set(h.date.toISOString().split("T")[0], h)
  );
  const holidays = Array.from(uniqueHolidaysMap.values());
  const relevantHolidays = holidays.filter(
    (h) => h.date >= startDate && h.date <= calculationEndDate
  );

  const allWorkdays = getAllWorkdays(startDate, calculationEndDate, workdays);

  const holidayDates = relevantHolidays.map(
    (h) => h.date.toISOString().split("T")[0]
  );
  // Log the holiday dates being used for filtering workdays
  console.log(
    "[Optimizer] Holiday dates used for filtering workdays:",
    holidayDates
  );

  const workdaysWithoutHolidays = allWorkdays.filter(
    (day) => !holidayDates.includes(day.toISOString().split("T")[0])
  );

  const companyVacationDatesInfo = processCompanyVacationDays(
    companyVacationDays,
    workdaysWithoutHolidays
  );

  // The input 'remainingVacationDays' is now the budget for the optimizer.
  const optimizerBudget = remainingVacationDays;

  const holidaysByMonth = groupHolidaysByMonth(relevantHolidays);

  const vacationPeriods = findOptimalVacationPeriods(
    workdaysWithoutHolidays,
    optimizerBudget, // Use the direct budget for the optimizer
    relevantHolidays,
    workdays,
    holidaysByMonth,
    remoteWorkdays,
    companyVacationDatesInfo.dates as Date[]
  );

  const allVacationPeriodsRaw = [
    ...vacationPeriods,
    ...companyVacationDatesInfo.periods,
  ];

  const allVacationPeriods = allVacationPeriodsRaw.filter(
    (period) => period.startDate.getFullYear() === year
  );

  // Calculate the number/cost of optimized days (excluding company days)
  const optimizedVacationDaysCost = vacationPeriods.reduce(
    (sum, period) => sum + period.vacationDays.length,
    0
  );

  // Total cost is the sum of optimizer-chosen days + company days cost
  const totalVacationCost =
    optimizedVacationDaysCost + companyVacationDatesInfo.totalDays;

  // Final remaining days = Initial budget - optimizer-chosen days
  // (Company days cost doesn't affect the *remaining* from the planning budget)
  const finalRemainingVacationDays =
    optimizerBudget - optimizedVacationDaysCost;

  const recommendedDays = allVacationPeriods.flatMap((period) =>
    period.vacationDays.map((day: Date) => day.toISOString())
  );

  const totalDaysOff = allVacationPeriods.reduce(
    (sum, period) => sum + period.totalDays,
    0
  );

  const actualVacationDaysUsed = allVacationPeriods.reduce(
    (sum, period) => sum + period.vacationDays.length,
    0
  );

  const endOfYear = new Date(year, 11, 31);
  const workdaysInYear = getAllWorkdays(startDate, endOfYear, workdays);
  const remoteWorkdayDates = workdaysInYear
    .filter(
      (day) =>
        isRemoteDay(day, remoteWorkdays) &&
        !holidayDates.includes(day.toISOString().split("T")[0])
    )
    .map((day) => day.toISOString());

  console.log(
    "[Optimizer] Final remoteWorkdayDates:",
    remoteWorkdayDates.slice(0, 10)
  ); // Log first 10

  const displayHolidays = holidays.filter((h) => h.date.getFullYear() === year);

  const result: VacationPlan = {
    recommendedDays,
    totalDaysOff,
    remainingVacationDays: finalRemainingVacationDays,
    optimizerBudget: optimizerBudget,
    totalVacationDaysUsed: totalVacationCost,
    companyVacationDaysCost: companyVacationDatesInfo.totalDays,
    vacationPeriods: allVacationPeriods.map((period) => ({
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
      totalDays: period.totalDays,
      vacationDaysUsed: period.vacationDays.length,
      includes: period.includes,
      isCompanyVacation: period.isCompanyVacation || false,
    })),
    holidays: displayHolidays.map((h) => ({
      date: h.date.toISOString(),
      name: h.name,
    })),
    remoteWorkdays: remoteWorkdayDates,
    companyVacationDays: companyVacationDatesInfo.dates
      .filter((d) => d.getFullYear() === year)
      .map((d) => d.toISOString()),
  };

  console.log(
    "[Optimizer] Final Plan companyVacationDays:",
    result.companyVacationDays
  );
  return result;
}

function processCompanyVacationDays(
  companyVacationDays: CompanyVacationDay[],
  workdays: Date[]
): {
  dates: Date[];
  totalDays: number;
  periods: VacationPeriod[];
} {
  if (!companyVacationDays || companyVacationDays.length === 0) {
    return { dates: [], totalDays: 0, periods: [] };
  }

  const companyVacationDatesMap = new Map<
    string,
    { date: Date; duration: number }
  >();
  const periods: VacationPeriod[] = [];
  let totalDays = 0;

  const workdaysSet = new Set(
    workdays.map((d) => d.toISOString().split("T")[0])
  );

  console.log(
    `[Optimizer] processCompanyVacationDays: Processing ${companyVacationDays.length} input days against ${workdaysSet.size} workdays.`
  );

  companyVacationDays.forEach((vacationDay) => {
    // Directly parse the ISO string to avoid local timezone issues during Date creation
    const year = parseInt(vacationDay.date.substring(0, 4), 10);
    const month = parseInt(vacationDay.date.substring(5, 7), 10) - 1; // JS months are 0-indexed
    const day = parseInt(vacationDay.date.substring(8, 10), 10);

    // Create a Date object representing the START of the UTC day
    const date = new Date(Date.UTC(year, month, day));

    const dateStr = date.toISOString().split("T")[0]; // Get UTC date string YYYY-MM-DD
    const duration = vacationDay.duration;

    const isWorkdayCheck = workdaysSet.has(dateStr);
    console.log(
      `[Optimizer] processCompanyVacationDays Check: Input=${vacationDay.date}, CheckDateStr=${dateStr}, Duration=${duration}, IsWorkday=${isWorkdayCheck}`
    );

    if (isWorkdayCheck) {
      // Store the consistent UTC start-of-day Date object
      companyVacationDatesMap.set(date.toISOString(), { date, duration });
      totalDays += duration;

      // Create period info (using the same UTC start-of-day date)
      periods.push({
        startDate: date,
        endDate: date,
        vacationDays: [date],
        totalDays: 1, // Base total days, might need adjustment for non-workdays around it?
        efficiency: 1 / duration, // Efficiency based on duration
        includes: [], // Will be populated later if periods are merged
        isCompanyVacation: true,
      });
    }
  });

  const dates = Array.from(companyVacationDatesMap.values()).map(
    (info) => info.date
  );

  console.log(
    "[Optimizer] processCompanyVacationDays Output Dates:",
    dates.map((d) => d.toISOString())
  );

  // TODO: Consider merging adjacent company vacation periods here?

  periods.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  return { dates, totalDays, periods };
}

function groupHolidaysByMonth(holidays: Holiday[]): {
  [month: number]: Holiday[];
} {
  const result: { [month: number]: Holiday[] } = {};

  for (const holiday of holidays) {
    const month = holiday.date.getUTCMonth();
    if (!result[month]) {
      result[month] = [];
    }
    result[month].push(holiday);
  }

  return result;
}

function getAllWorkdays(
  startDate: Date,
  endDate: Date,
  workdays: number[]
): Date[] {
  const result: Date[] = [];
  console.log(
    `[Optimizer] getAllWorkdays: Starting from ${startDate.toISOString()} to ${endDate.toISOString()}`
  );
  const currentDate = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate()
    )
  );

  const finalEndDate = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );

  let loggedCount = 0;
  const maxLogs = 5;

  while (currentDate <= finalEndDate) {
    const dayOfWeek = currentDate.getUTCDay();

    if (loggedCount < maxLogs) {
      console.log(
        `[Optimizer] getAllWorkdays check: ${currentDate.toISOString()}, UTC Day: ${dayOfWeek}`
      );
      loggedCount++;
    }

    if (workdays.includes(dayOfWeek)) {
      result.push(new Date(currentDate));
    }

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return result;
}

function findOptimalVacationPeriods(
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

function findBridgeDays(
  availableWorkdays: Date[],
  holidays: Holiday[],
  holidayDates: Set<string>,
  workdayNumbers: number[],
  maxDays: number,
  remoteWorkdays: number[] = [],
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

// Helper function to check if a Date object is valid
function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

// --- Helper function to find the true start of an off-period ---
function findPeriodStart(
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
function findPeriodEnd(
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

function isConsecutiveWorkday(
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

function distributeRemainingDays(
  availableWorkdays: Date[],
  remainingDays: number,
  holidays: Holiday[],
  holidayDates: Set<string>,
  workdayNumbers: number[],
  holidaysByMonth: { [month: number]: Holiday[] },
  existingPeriods: VacationPeriod[],
  remoteWorkdays: number[] = [],
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

function createLongWeekends(
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

function isRemoteDay(date: Date, remoteWorkdays: number[]): boolean {
  const dayOfWeek = date.getUTCDay();
  const isRemote = remoteWorkdays.includes(dayOfWeek);
  return isRemote;
}

function isDateInPeriods(date: Date, periods: VacationPeriod[]): boolean {
  const dateStr = date.toISOString().split("T")[0];

  for (const period of periods) {
    for (const vacationDay of period.vacationDays) {
      if (vacationDay.toISOString().split("T")[0] === dateStr) {
        return true;
      }
    }
  }
  return false;
}

function isWorkday(date: Date, workdayNumbers: number[]): boolean {
  return workdayNumbers.includes(date.getUTCDay());
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function calculateTotalDaysOffInclusive(
  startDate: Date,
  endDate: Date
): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
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

// Renaming unused functions to satisfy linter
function _isHoliday(date: Date, holidays: Holiday[]): boolean {
  const dateStr = date.toISOString().split("T")[0];
  return holidays.some((h) => h.date.toISOString().split("T")[0] === dateStr);
}

function _isCompanyVacationDay(
  date: Date,
  companyVacationDates: Set<string>
): boolean {
  const dateStr = date.toISOString().split("T")[0];
  return companyVacationDates.has(dateStr);
}
