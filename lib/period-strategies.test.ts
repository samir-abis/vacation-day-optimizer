import { describe, test, expect, beforeEach } from "bun:test";
import {
  findPeriodStart,
  findPeriodEnd,
  findOptimalVacationPeriods,
  PotentialPeriod,
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
    test("should find a simple bridge period and return PotentialPeriod objects", () => {
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

      expect(results.length).toBeGreaterThan(0);
      // Check the structure of the first result
      const bestPeriod = results[0] as PotentialPeriod; // Cast to PotentialPeriod for type checking
      expect(bestPeriod.vacationDays.length).toBeLessThanOrEqual(remainingDays);
      expect(bestPeriod.startDate).toBeInstanceOf(Date);
      expect(bestPeriod.endDate).toBeInstanceOf(Date);
      expect(bestPeriod.totalDays).toBeGreaterThan(0);
      expect(bestPeriod.score).toBeDefined();
      expect(bestPeriod.score).toBeTypeOf("number");
      expect(bestPeriod.type).toBeDefined();
      expect(bestPeriod.type).toBeTypeOf("string");
      expect([
        "bridge",
        "holiday-link",
        "long-weekend",
        "holiday-bridge",
      ]).toContain(bestPeriod.type);
      expect(bestPeriod.month).toBeDefined();
      expect(bestPeriod.month).toBeTypeOf("number");
      expect(bestPeriod.month).toBeGreaterThanOrEqual(0);
      expect(bestPeriod.month).toBeLessThanOrEqual(11);

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

    test("should prioritize a high-value holiday bridge", () => {
      // Scenario: Two holidays close together (like Pfingstmontag & Fronleichnam)
      const holidaysDE: Holiday[] = [
        { date: new Date("2025-06-09"), name: "Pfingstmontag" }, // Monday
        { date: new Date("2025-06-19"), name: "Fronleichnam" }, // Thursday
        { date: new Date("2025-12-25"), name: "Christmas" },
        { date: new Date("2025-12-26"), name: "Boxing Day" },
      ];
      const holidayDatesDE = new Set(
        holidaysDE.map((h) => h.date.toISOString().split("T")[0])
      );

      // Generate workdays between May and July 2025
      const start = new Date("2025-05-01");
      const end = new Date("2025-07-31");
      const workdaysInRangeDE: Date[] = [];
      let current = start;
      while (current <= end) {
        const dayNum = current.getUTCDay();
        const dateStr = current.toISOString().split("T")[0];
        if (dayNum >= 1 && dayNum <= 5 && !holidayDatesDE.has(dateStr)) {
          // Mon-Fri, not holiday
          workdaysInRangeDE.push(new Date(current));
        }
        current = addDays(current, 1);
      }

      const remainingDaysDE = 10;

      const resultsDE = findOptimalVacationPeriods(
        workdaysInRangeDE,
        remainingDaysDE,
        holidaysDE,
        [1, 2, 3, 4, 5],
        {},
        [],
        [],
        new Set()
      );

      expect(resultsDE.length).toBeGreaterThan(0);

      // Find the holiday bridge period within the results (which are sorted by start date)
      const holidayBridgePeriod = resultsDE.find(
        (p) => p.type === "holiday-bridge" && p.vacationDays.length === 7
      );

      // Assert that the holiday bridge period was found and selected
      expect(holidayBridgePeriod).toBeDefined();

      // Assert properties of the found holiday bridge period
      if (holidayBridgePeriod) {
        // Type guard
        expect(holidayBridgePeriod.type).toBe("holiday-bridge");
        expect(holidayBridgePeriod.vacationDays.length).toBe(7);
        expect(
          holidayBridgePeriod.vacationDays.map(
            (d) => d.toISOString().split("T")[0]
          )
        ).toEqual([
          "2025-06-10",
          "2025-06-11",
          "2025-06-12",
          "2025-06-13", // Tue-Fri
          "2025-06-16",
          "2025-06-17",
          "2025-06-18", // Mon-Wed
        ]);
        // Check calculated start/end dates including surrounding weekend/holidays
        expect(holidayBridgePeriod.startDate.toISOString().split("T")[0]).toBe(
          "2025-06-07"
        ); // Saturday before
        expect(holidayBridgePeriod.endDate.toISOString().split("T")[0]).toBe(
          "2025-06-19"
        ); // Fronleichnam holiday
        expect(holidayBridgePeriod.totalDays).toBe(13); // Sat(7) -> Thu(19) inclusive
      }
    });

    test("should skip highest scoring period if budget is insufficient", () => {
      // Use the same setup as the holiday bridge test
      const holidaysDE: Holiday[] = [
        { date: new Date("2025-06-09"), name: "Pfingstmontag" }, // Monday
        { date: new Date("2025-06-19"), name: "Fronleichnam" }, // Thursday
        { date: new Date("2025-12-25"), name: "Christmas" },
        { date: new Date("2025-12-26"), name: "Boxing Day" },
      ];
      const holidayDatesDE = new Set(
        holidaysDE.map((h) => h.date.toISOString().split("T")[0])
      );
      const start = new Date("2025-05-01");
      const end = new Date("2025-07-31");
      const workdaysInRangeDE: Date[] = [];
      let current = start;
      while (current <= end) {
        const dayNum = current.getUTCDay();
        const dateStr = current.toISOString().split("T")[0];
        if (dayNum >= 1 && dayNum <= 5 && !holidayDatesDE.has(dateStr)) {
          // Mon-Fri, not holiday
          workdaysInRangeDE.push(new Date(current));
        }
        current = addDays(current, 1);
      }

      // Provide a budget smaller than the cost of the best holiday bridge (7 days)
      const remainingDaysDE = 6;

      const resultsDE = findOptimalVacationPeriods(
        workdaysInRangeDE,
        remainingDaysDE,
        holidaysDE,
        [1, 2, 3, 4, 5],
        {},
        [],
        [],
        new Set()
      );

      expect(resultsDE.length).toBeGreaterThan(0);

      // Expect the 7-day holiday bridge NOT to be present
      const holidayBridgePeriod = resultsDE.find(
        (p) => p.type === "holiday-bridge" && p.vacationDays.length === 7
      );
      expect(holidayBridgePeriod).toBeUndefined();

      // Expect other, shorter periods to be selected instead (e.g., long weekends, shorter bridges)
      // Verify the total cost of selected periods is within the budget
      const totalCost = resultsDE.reduce(
        (sum, p) => sum + p.vacationDays.length,
        0
      );
      expect(totalCost).toBeLessThanOrEqual(remainingDaysDE);
    });

    test("should penalize taking vacation on remote days", () => {
      const holidaysSimple: Holiday[] = [
        { date: new Date("2024-11-11"), name: "Veterans Day Observed" }, // Monday
      ];
      const holidayDatesSimple = new Set(
        holidaysSimple.map((h) => h.date.toISOString().split("T")[0])
      );
      // Scenario: Friday Nov 8th is a remote day
      const remoteDates = new Set(["2024-11-08"]);
      const workdaysInRangeSimple = [
        new Date("2024-11-04"), // Mon
        new Date("2024-11-05"), // Tue
        new Date("2024-11-06"), // Wed
        new Date("2024-11-07"), // Thu
        new Date("2024-11-08"), // Fri (REMOTE)
        // Nov 9/10 Weekend
        // Nov 11 Holiday (Mon)
        new Date("2024-11-12"), // Tue
        new Date("2024-11-13"), // Wed
        new Date("2024-11-14"), // Thu
        new Date("2024-11-15"), // Fri
      ];
      const remainingDaysSimple = 1;

      // --- Run WITHOUT remote penalty (for comparison baseline if needed, but mainly test with penalty) ---
      // const resultsWithoutPenalty = findOptimalVacationPeriods(
      //     workdaysInRangeSimple,
      //     remainingDaysSimple,
      //     holidaysSimple,
      //     [1, 2, 3, 4, 5],
      //     {},
      //     [], // No remote *numbers* needed if passing remoteDates
      //     [],
      //     new Set() // No remote dates passed initially
      // );
      // expect(resultsWithoutPenalty[0].vacationDays.map(d => d.toISOString().split('T')[0])).toEqual(["2024-11-08"]);

      // --- Run WITH remote penalty ---
      const resultsWithPenalty = findOptimalVacationPeriods(
        workdaysInRangeSimple,
        remainingDaysSimple,
        holidaysSimple,
        [1, 2, 3, 4, 5],
        {},
        [], // No remote *numbers* needed as we pass the set
        [],
        remoteDates // Pass the remote dates set
      );

      expect(resultsWithPenalty.length).toBeGreaterThan(0);

      // Expect taking Friday Nov 8th (remote) to be penalized and NOT selected.
      // Instead, taking Tuesday Nov 12th should be preferred (links holiday Mon to weekend before).
      const selectedPeriod = resultsWithPenalty[0] as PotentialPeriod;
      expect(selectedPeriod.vacationDays.length).toBe(1);
      expect(selectedPeriod.vacationDays[0].toISOString().split("T")[0]).toBe(
        "2024-11-12"
      );
      expect(selectedPeriod.type).toBe("holiday-link"); // Or potentially long-weekend depending on tie-break
      // Verify the penalized option (Nov 8) is not selected
      const foundPenalizedOption = resultsWithPenalty.some(
        (p) =>
          p.vacationDays.length === 1 &&
          p.vacationDays[0].toISOString().split("T")[0] === "2024-11-08"
      );
      expect(foundPenalizedOption).toBe(false);
    });

    // TODO: Add more tests:
    // - Test budget constraints
  });
});

// Helper function (consider moving to a test utils file)
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
