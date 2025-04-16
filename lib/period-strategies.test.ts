import { describe, test, expect, beforeEach } from "bun:test";
import {
  findPeriodStart,
  findPeriodEnd,
  findOptimalVacationPeriods,
} from "./period-strategies";
import { Holiday } from "./holidays";
import { VacationPeriod } from "./types";

// --- Mock Data --- (Expand as needed)
const holidays: Holiday[] = [
  {
    date: new Date("2024-01-01"), // Monday
    name: "New Year's Day",
  },
  {
    date: new Date("2024-12-25"), // Wednesday
    name: "Christmas Day",
  },
  {
    date: new Date("2024-12-26"), // Thursday
    name: "Boxing Day",
  },
];

const holidayDates = new Set(
  holidays.map((h) => h.date.toISOString().split("T")[0])
);
const companyVacationDates = new Set<string>(["2024-12-24"]); // Tuesday
const remoteWorkdayDates = new Set<string>(["2024-12-23"]); // Monday
const workdayNumbers = [1, 2, 3, 4, 5]; // Mon-Fri

describe("Period Strategies", () => {
  describe("findPeriodStart", () => {
    test("should return the same day if the day before is a workday", () => {
      const vacationStart = new Date("2024-03-15"); // Friday
      const expectedStart = new Date("2024-03-15");
      expect(
        findPeriodStart(
          vacationStart,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        ).toISOString()
      ).toBe(expectedStart.toISOString());
    });

    test("should go back past a weekend", () => {
      const vacationStart = new Date("2024-03-18"); // Monday
      const expectedStart = new Date("2024-03-16"); // Saturday
      expect(
        findPeriodStart(
          vacationStart,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        ).toISOString()
      ).toBe(expectedStart.toISOString());
    });

    test("should go back past a holiday", () => {
      const vacationStart = new Date("2024-01-02"); // Tuesday
      const expectedStart = new Date("2023-12-30"); // Saturday (includes weekend before NYD)
      expect(
        findPeriodStart(
          vacationStart,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        ).toISOString()
      ).toBe(expectedStart.toISOString());
    });

    test("should go back past a company vacation day", () => {
      const vacationStart = new Date("2024-12-25"); // Wednesday (Christmas)
      const expectedStart = new Date("2024-12-21"); // Saturday (includes weekend, remote Mon, company Tue)
      expect(
        findPeriodStart(
          vacationStart,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        ).toISOString()
      ).toBe(expectedStart.toISOString());
    });

    test("should go back past a remote workday", () => {
      const vacationStart = new Date("2024-12-24"); // Tuesday (Company Vac)
      const expectedStart = new Date("2024-12-21"); // Saturday (includes weekend, remote Mon)
      expect(
        findPeriodStart(
          vacationStart,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        ).toISOString()
      ).toBe(expectedStart.toISOString());
    });

    test("should handle multiple non-work days sequentially", () => {
      const vacationStart = new Date("2024-12-27"); // Friday
      const expectedStart = new Date("2024-12-21"); // Sat (Weekend, Remote Mon, Comp Tue, Xmas Wed, Boxing Thu)
      expect(
        findPeriodStart(
          vacationStart,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        ).toISOString()
      ).toBe(expectedStart.toISOString());
    });

    test("should not go back indefinitely", () => {
      // Add a long stretch of holidays/weekends etc.
      const longHolidays = new Set<string>();
      const start = new Date("2024-04-01");
      for (let i = 0; i < 40; i++) {
        longHolidays.add(addDays(start, -i).toISOString().split("T")[0]);
      }
      const vacationStart = new Date("2024-04-01");
      // Expect it to stop after ~30 days due to MAX_ITERATIONS
      const expectedStart = addDays(vacationStart, -30);
      expect(
        findPeriodStart(
          vacationStart,
          workdayNumbers,
          longHolidays,
          new Set(),
          new Set()
        ).toISOString()
      ).toBe(expectedStart.toISOString());
    });
  });

  describe("findPeriodEnd", () => {
    test("should return the same day if the day after is a workday", () => {
      const vacationEnd = new Date("2024-03-14"); // Thursday
      const expectedEnd = new Date("2024-03-14");
      expect(
        findPeriodEnd(
          vacationEnd,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        ).toISOString()
      ).toBe(expectedEnd.toISOString());
    });

    test("should go forward past a weekend", () => {
      const vacationEnd = new Date("2024-03-15"); // Friday
      const expectedEnd = new Date("2024-03-17"); // Sunday
      expect(
        findPeriodEnd(
          vacationEnd,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        ).toISOString()
      ).toBe(expectedEnd.toISOString());
    });

    test("should go forward past holidays", () => {
      const vacationEnd = new Date("2024-12-24"); // Tuesday (Company Vac)
      const expectedEnd = new Date("2024-12-26"); // Thursday (Boxing Day)
      expect(
        findPeriodEnd(
          vacationEnd,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        ).toISOString()
      ).toBe(expectedEnd.toISOString());
    });

    test("should go forward past a remote workday", () => {
      const vacationEnd = new Date("2024-12-20"); // Friday
      const expectedEnd = new Date("2024-12-26"); // Thursday (Extends past weekend, remote Mon, company Tue, holidays Wed/Thu)
      expect(
        findPeriodEnd(
          vacationEnd,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        ).toISOString()
      ).toBe(expectedEnd.toISOString());
    });

    test("should handle multiple non-work days sequentially", () => {
      const vacationEnd = new Date("2024-12-20"); // Friday
      const expectedEnd = new Date("2024-12-26"); // Thursday (Weekend, Remote Mon, Comp Tue, Xmas Wed, Boxing Thu)
      expect(
        findPeriodEnd(
          vacationEnd,
          workdayNumbers,
          holidayDates,
          companyVacationDates,
          remoteWorkdayDates
        ).toISOString()
      ).toBe(expectedEnd.toISOString());
    });

    test("should not go forward indefinitely", () => {
      // Add a long stretch of holidays/weekends etc.
      const longHolidays = new Set<string>();
      const start = new Date("2024-04-01");
      for (let i = 0; i < 40; i++) {
        longHolidays.add(addDays(start, i).toISOString().split("T")[0]);
      }
      const vacationEnd = new Date("2024-04-01");
      // Expect it to stop after ~30 days due to MAX_ITERATIONS
      const expectedEnd = addDays(vacationEnd, 30);
      expect(
        findPeriodEnd(
          vacationEnd,
          workdayNumbers,
          longHolidays,
          new Set(),
          new Set()
        ).toISOString()
      ).toBe(expectedEnd.toISOString());
    });
  });

  describe("findOptimalVacationPeriods", () => {
    // Basic integration test - more detailed tests can be added
    test("should find a simple bridge period", () => {
      const workdaysInRange = [
        new Date("2024-05-20"), // Mon
        new Date("2024-05-21"), // Tue
        new Date("2024-05-22"), // Wed
        new Date("2024-05-23"), // Thu
        new Date("2024-05-24"), // Fri
        new Date("2024-05-27"), // Mon
        new Date("2024-05-28"), // Tue
        new Date("2024-05-29"), // Wed
        new Date("2024-05-30"), // Thu
        new Date("2024-05-31"), // Fri
      ];
      const localHolidays: Holiday[] = [
        { date: new Date("2024-05-25"), name: "Fake Sat Holiday" }, // Weekend
        { date: new Date("2024-05-26"), name: "Fake Sun Holiday" }, // Weekend
      ];
      const localHolidayDates = new Set(
        localHolidays.map((h) => h.date.toISOString().split("T")[0])
      );
      const remainingDays = 4;

      const results = findOptimalVacationPeriods(
        workdaysInRange,
        remainingDays,
        localHolidays,
        workdayNumbers,
        {},
        [],
        [],
        new Set()
      );

      // Expect it to suggest taking Tue-Fri off to bridge the weekends
      // Or Mon-Thu off before the weekend
      // Or potentially a different bridge depending on scoring
      expect(results.length).toBeGreaterThan(0);
      // Assuming the bridge strategy is dominant for this short period
      const bestPeriod = results[0];
      expect(bestPeriod.vacationDays.length).toBeLessThanOrEqual(remainingDays);
      // Basic check: Ensure start/end make sense relative to vacation days
      expect(bestPeriod.startDate.getTime()).toBeLessThanOrEqual(
        bestPeriod.vacationDays[0].getTime()
      );
      expect(bestPeriod.endDate.getTime()).toBeGreaterThanOrEqual(
        bestPeriod.vacationDays[bestPeriod.vacationDays.length - 1].getTime()
      );

      // A more specific check if we know the expected outcome:
      // expect(bestPeriod.vacationDays.map(d => d.toISOString().split("T")[0]))
      //   .toEqual(["2024-05-21", "2024-05-22", "2024-05-23", "2024-05-24"]);
      // expect(bestPeriod.startDate.toISOString().split("T")[0]).toBe("2024-05-21");
      // expect(bestPeriod.endDate.toISOString().split("T")[0]).toBe("2024-05-26"); // Includes weekend
    });

    // TODO: Add more tests:
    // - Test holiday linking
    // - Test long weekends
    // - Test with company vacation days
    // - Test with remote workdays (scoring impacts)
    // - Test budget constraints (not enough days for best option)
    // - Test overlapping potential periods selection logic
    // - Test edge cases (year boundaries, no holidays, etc.)
  });
});

// Helper function (consider moving to a test utils file)
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
