import { VacationPeriod } from "./types";

// Helper function to check if a Date object is valid
export function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function isWorkday(date: Date, workdayNumbers: number[]): boolean {
  return workdayNumbers.includes(date.getUTCDay());
}

export function calculateTotalDaysOffInclusive(
  startDate: Date,
  endDate: Date
): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

export function getAllWorkdays(
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

export function isRemoteDay(date: Date, remoteWorkdays: number[]): boolean {
  const dayOfWeek = date.getUTCDay();
  const isRemote = remoteWorkdays.includes(dayOfWeek);
  return isRemote;
}

export function isDateInPeriods(
  date: Date,
  periods: VacationPeriod[]
): boolean {
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
