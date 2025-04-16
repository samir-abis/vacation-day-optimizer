import { Holiday } from "./holidays";
import { VacationPeriod, VacationPlan, VacationDay } from "./types";
import { getAllWorkdays, isRemoteDay, addDays } from "./date-utils";
import {
  findOptimalVacationPeriods,
  PotentialPeriod,
} from "./period-strategies";

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

// Get holidays relevant for optimization range (adjust lookahead/lookbehind)
function getRelevantHolidays(
  holidays: Holiday[],
  optimizationStartDate: Date,
  calculationEndDate: Date // Use the actual calculation end date
): Holiday[] {
  const relevant: Holiday[] = [];
  const startMs = optimizationStartDate.getTime();
  const endMs = calculationEndDate.getTime();

  console.log(
    `[Optimizer] Filtering relevant holidays between ${
      optimizationStartDate.toISOString().split("T")[0]
    } and ${calculationEndDate.toISOString().split("T")[0]}`
  );

  for (const holiday of holidays) {
    const holidayMs = holiday.date.getTime();
    // Include holidays that fall exactly on the start or end date
    if (holidayMs >= startMs && holidayMs <= endMs) {
      relevant.push(holiday);
    }
  }
  console.log(
    `[Optimizer] Found ${relevant.length} relevant holidays for calculation.`
  );
  relevant.forEach((h) =>
    console.log(`  - Relevant Holiday: ${h.date.toISOString().split("T")[0]}`)
  );
  return relevant;
}

export function calculateOptimalVacationPlan(
  initialStartDate: Date,
  initialEndDate: Date,
  remainingVacationDays: number,
  allFetchedHolidays: Holiday[],
  workdayNumbers: number[],
  remoteWorkdays: number[] = [],
  companyVacationInputDays: VacationDay[] = [],
  userMandatoryInputDays: VacationDay[] = [],
  lookaheadDays: number = 60
): VacationPlan {
  console.log(
    "[Optimizer] Received userMandatoryInputDays:",
    userMandatoryInputDays
  );
  // --- Date Range Setup ---
  const optimizationStartDate = new Date(initialStartDate);
  const optimizationEndDate = new Date(initialEndDate);
  const calculationEndDate = addDays(optimizationEndDate, lookaheadDays);

  console.log(
    `[Optimizer] Effective Optimization Start Date: ${optimizationStartDate.toISOString()}`
  );
  console.log(
    `[Optimizer] Effective Optimization End Date: ${optimizationEndDate.toISOString()}`
  );
  console.log(
    `[Optimizer] Calculation End Date (with lookahead): ${calculationEndDate.toISOString()}`
  );

  // --- Holiday Preparation ---
  // 1. Filter fetched holidays for the *display* range (used for final plan output)
  const displayHolidays = allFetchedHolidays.filter((h) => {
    const holidayTime = h.date.getTime();
    const holidayYear = h.date.getUTCFullYear();
    const selectedYear = initialStartDate.getUTCFullYear();
    // Include holidays from both the selected year and the next year
    return holidayYear === selectedYear || holidayYear === selectedYear + 1;
  });
  console.log(
    `[Optimizer] Filtered ${
      displayHolidays.length
    } holidays for display from years ${initialStartDate.getUTCFullYear()} and ${
      initialStartDate.getUTCFullYear() + 1
    }.`
  );

  // 2. Get holidays relevant for the *optimization calculation* (including lookahead)
  const relevantHolidays = getRelevantHolidays(
    allFetchedHolidays,
    optimizationStartDate,
    calculationEndDate
  );
  const holidayDateStrings = new Set(
    relevantHolidays.map((h) => h.date.toISOString().split("T")[0])
  );
  console.log(
    `[Optimizer] Holiday dates used for filtering workdays:`,
    Array.from(holidayDateStrings)
  );

  // Group *relevant* holidays by month for period generation strategies
  const holidaysByMonth: { [month: number]: Holiday[] } = {};
  relevantHolidays.forEach((holiday) => {
    const month = holiday.date.getUTCMonth();
    if (!holidaysByMonth[month]) {
      holidaysByMonth[month] = [];
    }
    holidaysByMonth[month].push(holiday);
  });

  // --- Workday Calculation (Full Range) ---
  // Updated to match expected parameter count
  const workdaysInCalculationRange = getAllWorkdays(
    optimizationStartDate,
    calculationEndDate,
    workdayNumbers
  );
  console.log(
    `[Optimizer] Found ${workdaysInCalculationRange.length} potential workdays in calculation range (excluding holidays).`
  );

  // --- Remote Workday Identification (for full calculation range) ---
  const allRemoteWorkdayDates = new Set<string>();
  if (remoteWorkdays.length > 0) {
    workdaysInCalculationRange.forEach((day) => {
      if (isRemoteDay(day, remoteWorkdays)) {
        allRemoteWorkdayDates.add(day.toISOString().split("T")[0]);
      }
    });
    console.log(
      `[Optimizer] Identified ${allRemoteWorkdayDates.size} remote workday dates in calculation range.`
    );
  }

  // --- Company Vacation Day Processing ---
  const { companyVacationDates, companyVacationDaysCost } =
    processCompanyVacationDays(
      companyVacationInputDays,
      workdaysInCalculationRange,
      holidayDateStrings,
      allRemoteWorkdayDates
    );
  console.log(
    `[Optimizer] Processed Company Vacation: ${companyVacationDates.size} dates costing ${companyVacationDaysCost} days.`
  );

  // --- User Mandatory Vacation Day Processing ---
  const { userMandatoryDates, userMandatoryDaysCost } =
    processUserMandatoryVacationDays(
      userMandatoryInputDays,
      workdaysInCalculationRange,
      holidayDateStrings,
      allRemoteWorkdayDates,
      companyVacationDates
    );
  console.log(
    `[Optimizer] Processed User Mandatory Vacation: ${userMandatoryDates.size} dates costing ${userMandatoryDaysCost} days.`
  );

  // --- Prepare Available Workdays for Optimization ---
  // Filter workdays within the optimization range, excluding holidays, company days, and remote days
  // AND excluding user mandatory days
  const availableWorkdaysForOptimizer = workdaysInCalculationRange.filter(
    (day: Date) => {
      const dateStr = day.toISOString().split("T")[0];
      const isHoliday = holidayDateStrings.has(dateStr);
      const isCompanyDay = companyVacationDates.has(dateStr);
      const isUserMandatoryDay = userMandatoryDates.has(dateStr);
      const isRemote = allRemoteWorkdayDates.has(dateStr); // Check against the full set
      return !isHoliday && !isCompanyDay && !isUserMandatoryDay && !isRemote;
    }
  );
  console.log(
    `[Optimizer] Workdays available for planning vacation (post-filtering): ${availableWorkdaysForOptimizer.length}`
  );

  // --- Optimization ---
  // Adjust budget by subtracting pre-allocated company and user days
  const optimizerBudget = Math.max(
    0,
    remainingVacationDays - companyVacationDaysCost - userMandatoryDaysCost
  );
  console.log(
    `[Optimizer] Original budget: ${remainingVacationDays}, Company cost: ${companyVacationDaysCost}, User cost: ${userMandatoryDaysCost}, Effective budget for optimizer: ${optimizerBudget}`
  );

  const finalPeriods: PotentialPeriod[] = findOptimalVacationPeriods(
    availableWorkdaysForOptimizer,
    optimizerBudget, // Pass the adjusted budget
    relevantHolidays,
    workdayNumbers,
    holidaysByMonth,
    remoteWorkdays,
    // Pass company vacation *dates* (as Date objects) identified by processing
    Array.from(companyVacationDates).map((d) => new Date(d + "T00:00:00.000Z")),
    allRemoteWorkdayDates
  );

  // --- Result Aggregation ---
  let totalDaysOff = 0;
  const recommendedDaysUTCSet = new Set<string>();
  let calculatedOptimizerCost = 0;

  finalPeriods.forEach((period) => {
    // Only aggregate cost/days off for non-company periods
    if (!period.isCompanyVacation) {
      totalDaysOff += period.totalDays;
      calculatedOptimizerCost += period.vacationDays.length;
      period.vacationDays.forEach((day: Date) => {
        recommendedDaysUTCSet.add(day.toISOString().split("T")[0]);
      });
    }
  });

  // Add company vacation days to the recommended list
  companyVacationDates.forEach((dateStr: string) => {
    recommendedDaysUTCSet.add(dateStr);
  });

  // Add user mandatory vacation days to the recommended list
  userMandatoryDates.forEach((dateStr: string) => {
    recommendedDaysUTCSet.add(dateStr);
  });

  // Combine optimizer cost and pre-calculated company/user cost
  const totalVacationDaysUsed =
    calculatedOptimizerCost + companyVacationDaysCost + userMandatoryDaysCost;

  const recommendedDays = Array.from(recommendedDaysUTCSet)
    .map((dateStr) => new Date(dateStr + "T00:00:00.000Z"))
    .sort((a, b) => a.getTime() - b.getTime());

  const actualRemainingBudget = Math.max(
    0,
    optimizerBudget - calculatedOptimizerCost
  );

  console.log(
    `[Optimizer] Final Plan - Recommended Days (incl. company): ${recommendedDays.length}`
  );
  console.log(`[Optimizer] Final Plan - Total Days Off: ${totalDaysOff}`);
  console.log(
    `[Optimizer] Final Plan - Total Vacation Used (Planned + Company + User): ${totalVacationDaysUsed}`
  );
  console.log(
    `[Optimizer] Final Plan - Company Vacation Cost: ${companyVacationDaysCost}`
  );
  console.log(
    `[Optimizer] Final Plan - User Mandatory Vacation Cost: ${userMandatoryDaysCost}`
  );
  console.log(
    `[Optimizer] Final Plan - Optimizer Budget Used: ${calculatedOptimizerCost}`
  );
  console.log(
    `[Optimizer] Final Plan - Remaining Budget (after all deductions): ${actualRemainingBudget}`
  );

  // --- Construct Final Plan Object ---
  const plan: VacationPlan = {
    recommendedDays: recommendedDays.map((d: Date) => d.toISOString()),
    totalDaysOff, // Reflects only optimizer periods' days off
    remainingVacationDays: actualRemainingBudget,
    // Map final periods, removing properties not in VacationPlanPeriod
    vacationPeriods: finalPeriods.map((p) => ({
      startDate: p.startDate.toISOString(),
      endDate: p.endDate.toISOString(),
      totalDays: p.totalDays,
      vacationDaysUsed: p.vacationDays.length,
      // Map vacationDays Date[] to string[]
      vacationDays: p.vacationDays.map((d: Date) => d.toISOString()),
      efficiency: p.efficiency,
      includes: p.includes,
      isCompanyVacation: !!p.isCompanyVacation,
      score: p.score,
      type: p.type,
    })),
    holidays: displayHolidays.map((h) => ({
      date: h.date.toISOString(),
      name: h.name,
    })),
    remoteWorkdays: Array.from(allRemoteWorkdayDates).map((d) =>
      new Date(d + "T00:00:00.000Z").toISOString()
    ),
    // Use the companyVacationDates Set directly
    companyVacationDays: Array.from(companyVacationDates).map((d) =>
      new Date(d + "T00:00:00.000Z").toISOString()
    ),
    // Add user mandatory days to the plan output
    userMandatoryVacationDays: Array.from(userMandatoryDates).map((d) =>
      new Date(d + "T00:00:00.000Z").toISOString()
    ),
    totalVacationDaysUsed,
    companyVacationDaysCost,
    userMandatoryDaysCost,
    optimizerBudget,
    workdayNumbers,
  };

  // Add final logging for the returned plan object
  console.log("[Optimizer] Final Plan Object being returned:", {
    recommendedDaysCount: plan.recommendedDays.length,
    totalDaysOff: plan.totalDaysOff,
    remainingVacationDays: plan.remainingVacationDays,
    vacationPeriodsCount: plan.vacationPeriods.length,
    holidaysCount: plan.holidays.length,
    remoteWorkdaysCount: plan.remoteWorkdays.length,
    companyVacationDaysCount: plan.companyVacationDays.length,
    userMandatoryVacationDaysCount: plan.userMandatoryVacationDays.length,
    totalVacationDaysUsed: plan.totalVacationDaysUsed,
    companyVacationDaysCost: plan.companyVacationDaysCost,
    userMandatoryDaysCost: plan.userMandatoryDaysCost,
    optimizerBudget: plan.optimizerBudget,
  });
  // Log first few holidays and remote days being returned
  console.log(
    "[Optimizer] First 5 Holidays in final plan:",
    plan.holidays
      .slice(0, 5)
      .map((h) => ({ date: h.date.split("T")[0], name: h.name }))
  );
  console.log(
    "[Optimizer] First 10 Remote Workdays in final plan:",
    plan.remoteWorkdays.slice(0, 10)
  );

  return plan;
}

// --- Function to process user mandatory vacation days ---
function processUserMandatoryVacationDays(
  userInputDays: VacationDay[],
  workdaysInRange: Date[],
  holidayDateStrings: Set<string>,
  remoteWorkdayDateStrings: Set<string>,
  companyVacationDateStrings: Set<string> // Avoid double-counting cost if also a company day
): { userMandatoryDates: Set<string>; userMandatoryDaysCost: number } {
  console.log(
    "[Optimizer] processUserMandatoryVacationDays received:",
    userInputDays
  );
  const userMandatoryDates = new Set<string>();
  let userMandatoryDaysCost = 0;

  if (!userInputDays || userInputDays.length === 0) {
    return { userMandatoryDates, userMandatoryDaysCost };
  }

  console.log(
    `[Optimizer] processUserMandatoryVacationDays: Processing ${userInputDays.length} input days.`
  );

  userInputDays.forEach((vacationDay) => {
    const year = parseInt(vacationDay.date.substring(0, 4), 10);
    const month = parseInt(vacationDay.date.substring(5, 7), 10) - 1;
    const day = parseInt(vacationDay.date.substring(8, 10), 10);
    const date = new Date(Date.UTC(year, month, day));
    const dateStr = date.toISOString().split("T")[0];
    const duration = vacationDay.duration;

    // Check if it's a workday within the provided range
    const isWorkdayCheck = workdaysInRange.some(
      (wd) => wd.toISOString().split("T")[0] === dateStr
    );
    const isHoliday = holidayDateStrings.has(dateStr);
    const isRemote = remoteWorkdayDateStrings.has(dateStr);
    const isAlsoCompanyDay = companyVacationDateStrings.has(dateStr);

    console.log(
      `[Optimizer] processUserMandatoryVacationDays Check: Input=${vacationDay.date}, CheckDateStr=${dateStr}, Duration=${duration}, IsWorkday=${isWorkdayCheck}, IsHoliday=${isHoliday}, IsRemote=${isRemote}, IsCompanyDay=${isAlsoCompanyDay}`
    );

    // Add to the set regardless, as it's a user-mandated day off
    userMandatoryDates.add(dateStr);

    // Only count cost if it's a workday that isn't also a holiday, remote day, OR an already accounted-for company day
    if (!isHoliday && !isAlsoCompanyDay) {
      // We assume if the user explicitly adds a day here, they intend to use vacation budget,
      // even if it's not a standard workday or a remote day (they might have specific plans).
      userMandatoryDaysCost += duration;
      console.log(
        `  - User mandatory day ${dateStr} cost added: ${duration}. IsWorkday=${isWorkdayCheck}, IsRemote=${isRemote}`
      );
    } else if (isAlsoCompanyDay) {
      console.log(
        `  - Note: User mandatory day ${dateStr} cost already covered by company vacation.`
      );
    } else if (isHoliday) {
      console.log(
        `  - Note: User mandatory day ${dateStr} identified but cost is 0 (Holiday).`
      );
    }
  });

  console.log(
    "[Optimizer] processUserMandatoryVacationDays Output Dates (Set):",
    Array.from(userMandatoryDates)
  );
  console.log(
    "[Optimizer] processUserMandatoryVacationDays Calculated Cost:",
    userMandatoryDaysCost
  );

  return { userMandatoryDates, userMandatoryDaysCost };
}

function processCompanyVacationDays(
  companyVacationInputDays: VacationDay[],
  workdaysInRange: Date[],
  holidayDateStrings: Set<string>,
  remoteWorkdayDateStrings: Set<string>
): { companyVacationDates: Set<string>; companyVacationDaysCost: number } {
  const companyVacationDates = new Set<string>();
  let companyVacationDaysCost = 0;

  if (!companyVacationInputDays || companyVacationInputDays.length === 0) {
    return { companyVacationDates, companyVacationDaysCost };
  }

  const companyVacationDatesMap = new Map<
    string,
    { date: Date; duration: number }
  >();

  console.log(
    `[Optimizer] processCompanyVacationDays: Processing ${companyVacationInputDays.length} input days against ${workdaysInRange.length} workdays.`
  );

  companyVacationInputDays.forEach((vacationDay) => {
    const year = parseInt(vacationDay.date.substring(0, 4), 10);
    const month = parseInt(vacationDay.date.substring(5, 7), 10) - 1;
    const day = parseInt(vacationDay.date.substring(8, 10), 10);
    const date = new Date(Date.UTC(year, month, day));
    const dateStr = date.toISOString().split("T")[0];
    const duration = vacationDay.duration;

    // Check if it's a workday *within the provided range*
    const isWorkdayCheck = workdaysInRange.some(
      (wd) => wd.toISOString().split("T")[0] === dateStr
    );
    const isHoliday = holidayDateStrings.has(dateStr);
    const isRemote = remoteWorkdayDateStrings.has(dateStr);

    console.log(
      `[Optimizer] processCompanyVacationDays Check: Input=${vacationDay.date}, CheckDateStr=${dateStr}, Duration=${duration}, IsWorkday=${isWorkdayCheck}, IsHoliday=${isHoliday}, IsRemote=${isRemote}`
    );

    // Only count cost if it's a workday that isn't also a holiday or remote day
    if (isWorkdayCheck && !isHoliday && !isRemote) {
      companyVacationDatesMap.set(date.toISOString(), { date, duration });
      companyVacationDates.add(dateStr);
      companyVacationDaysCost += duration;
    } else if (isWorkdayCheck) {
      // It's a workday but also a holiday/remote, add to set but don't count cost
      companyVacationDates.add(dateStr);
      console.log(
        `  - Note: Company day ${dateStr} identified but cost is 0 (Holiday/Remote).`
      );
    }
  });

  console.log(
    "[Optimizer] processCompanyVacationDays Output Dates (Set):",
    Array.from(companyVacationDates)
  );
  console.log(
    "[Optimizer] processCompanyVacationDays Calculated Cost:",
    companyVacationDaysCost
  );

  return { companyVacationDates, companyVacationDaysCost };
}
