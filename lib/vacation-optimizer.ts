import { Holiday, getNationalHolidays, getRegionalHolidays } from "./holidays";
import { VacationPeriod, CompanyVacationDay, VacationPlan } from "./types";
import { getAllWorkdays, isRemoteDay } from "./date-utils";
import { findOptimalVacationPeriods } from "./period-strategies";

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

  const _actualVacationDaysUsed = allVacationPeriods.reduce(
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
