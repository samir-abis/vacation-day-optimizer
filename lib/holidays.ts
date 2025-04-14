export const germanStates = [
  { value: "baden-wurttemberg", label: "Baden-Württemberg" },
  { value: "bavaria", label: "Bavaria" },
  { value: "berlin", label: "Berlin" },
  { value: "brandenburg", label: "Brandenburg" },
  { value: "bremen", label: "Bremen" },
  { value: "hamburg", label: "Hamburg" },
  { value: "hesse", label: "Hesse" },
  { value: "lower-saxony", label: "Lower Saxony" },
  { value: "mecklenburg-vorpommern", label: "Mecklenburg-Vorpommern" },
  { value: "north-rhine-westphalia", label: "North Rhine-Westphalia" },
  { value: "rhineland-palatinate", label: "Rhineland-Palatinate" },
  { value: "saarland", label: "Saarland" },
  { value: "saxony", label: "Saxony" },
  { value: "saxony-anhalt", label: "Saxony-Anhalt" },
  { value: "schleswig-holstein", label: "Schleswig-Holstein" },
  { value: "thuringia", label: "Thuringia" },
];

// Calculate Easter date for a given year
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

// Calculate movable holidays based on Easter
function calculateMovableHolidays(year: number): {
  goodFriday: { name: string; date: Date };
  easterMonday: { name: string; date: Date };
  ascensionDay: { name: string; date: Date };
  whitMonday: { name: string; date: Date };
  corpusChristi: { name: string; date: Date };
} {
  const easter = calculateEaster(year);

  // Good Friday (2 days before Easter)
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);

  // Easter Monday (1 day after Easter)
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  // Ascension Day (39 days after Easter)
  const ascensionDay = new Date(easter);
  ascensionDay.setDate(easter.getDate() + 39);

  // Whit Monday (50 days after Easter)
  const whitMonday = new Date(easter);
  whitMonday.setDate(easter.getDate() + 50);

  // Corpus Christi (60 days after Easter)
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);

  return {
    goodFriday: { name: "Good Friday", date: goodFriday },
    easterMonday: { name: "Easter Monday", date: easterMonday },
    ascensionDay: { name: "Ascension Day", date: ascensionDay },
    whitMonday: { name: "Whit Monday", date: whitMonday },
    corpusChristi: { name: "Corpus Christi", date: corpusChristi },
  };
}

export interface Holiday {
  name: string;
  date: Date;
}

// National holidays in Germany (fixed dates)
export function getNationalHolidays(year: number): Holiday[] {
  return [
    { name: "New Year's Day", date: new Date(year, 0, 1) },
    { name: "Labor Day", date: new Date(year, 4, 1) },
    { name: "German Unity Day", date: new Date(year, 9, 3) },
    { name: "Second Day of Christmas", date: new Date(year, 11, 26) },
    { name: "New Year's Eve", date: new Date(year, 11, 31) },
  ];
}

// Regional holidays in Germany
export function getRegionalHolidays(state: string, year: number): Holiday[] {
  const movableHolidays = calculateMovableHolidays(year);

  const stateHolidays: { [key: string]: Holiday[] } = {
    "baden-wurttemberg": [
      { name: "Epiphany", date: new Date(year, 0, 6) },
      movableHolidays.goodFriday,
      movableHolidays.easterMonday,
      movableHolidays.ascensionDay,
      movableHolidays.whitMonday,
      movableHolidays.corpusChristi,
      { name: "All Saints' Day", date: new Date(year, 10, 1) },
    ],
    bavaria: [
      { name: "Epiphany", date: new Date(year, 0, 6) },
      movableHolidays.goodFriday,
      movableHolidays.easterMonday,
      movableHolidays.ascensionDay,
      movableHolidays.whitMonday,
      movableHolidays.corpusChristi,
      { name: "Assumption Day", date: new Date(year, 7, 15) },
      { name: "All Saints' Day", date: new Date(year, 10, 1) },
    ],
    berlin: [
      { name: "Women's Day", date: new Date(year, 2, 8) },
      movableHolidays.goodFriday,
      movableHolidays.easterMonday,
      movableHolidays.ascensionDay,
      movableHolidays.whitMonday,
    ],
    // Add more states with their specific holidays
    brandenburg: [
      movableHolidays.goodFriday,
      movableHolidays.easterMonday,
      movableHolidays.ascensionDay,
      movableHolidays.whitMonday,
      { name: "Reformation Day", date: new Date(year, 9, 31) },
    ],
    bremen: [
      movableHolidays.goodFriday,
      movableHolidays.easterMonday,
      movableHolidays.ascensionDay,
      movableHolidays.whitMonday,
      { name: "Reformation Day", date: new Date(year, 9, 31) },
    ],
    hamburg: [
      movableHolidays.goodFriday,
      movableHolidays.easterMonday,
      movableHolidays.ascensionDay,
      movableHolidays.whitMonday,
      { name: "Reformation Day", date: new Date(year, 9, 31) },
    ],
    hesse: [
      movableHolidays.goodFriday,
      movableHolidays.easterMonday,
      movableHolidays.ascensionDay,
      movableHolidays.whitMonday,
      movableHolidays.corpusChristi,
    ],
    "lower-saxony": [
      movableHolidays.goodFriday,
      movableHolidays.easterMonday,
      movableHolidays.ascensionDay,
      movableHolidays.whitMonday,
      { name: "Reformation Day", date: new Date(year, 9, 31) },
    ],
    "mecklenburg-vorpommern": [
      movableHolidays.goodFriday,
      movableHolidays.easterMonday,
      movableHolidays.ascensionDay,
      movableHolidays.whitMonday,
      { name: "Reformation Day", date: new Date(year, 9, 31) },
    ],
    "north-rhine-westphalia": [
      movableHolidays.goodFriday,
      movableHolidays.easterMonday,
      movableHolidays.ascensionDay,
      movableHolidays.whitMonday,
      movableHolidays.corpusChristi,
      { name: "All Saints' Day", date: new Date(year, 10, 1) },
    ],
    "rhineland-palatinate": [
      movableHolidays.goodFriday,
      movableHolidays.easterMonday,
      movableHolidays.ascensionDay,
      movableHolidays.whitMonday,
      movableHolidays.corpusChristi,
      { name: "All Saints' Day", date: new Date(year, 10, 1) },
    ],
    saarland: [
      movableHolidays.goodFriday,
      movableHolidays.easterMonday,
      movableHolidays.ascensionDay,
      movableHolidays.whitMonday,
      movableHolidays.corpusChristi,
      { name: "Assumption Day", date: new Date(year, 7, 15) },
      { name: "All Saints' Day", date: new Date(year, 10, 1) },
    ],
    saxony: [
      movableHolidays.goodFriday,
      movableHolidays.easterMonday,
      movableHolidays.ascensionDay,
      movableHolidays.whitMonday,
      { name: "Reformation Day", date: new Date(year, 9, 31) },
      { name: "Day of Repentance", date: new Date(year, 10, 16) }, // Approximate, would need calculation
    ],
    "saxony-anhalt": [
      movableHolidays.goodFriday,
      movableHolidays.easterMonday,
      movableHolidays.ascensionDay,
      movableHolidays.whitMonday,
      { name: "Epiphany", date: new Date(year, 0, 6) },
      { name: "Reformation Day", date: new Date(year, 9, 31) },
    ],
    "schleswig-holstein": [
      movableHolidays.goodFriday,
      movableHolidays.easterMonday,
      movableHolidays.ascensionDay,
      movableHolidays.whitMonday,
      { name: "Reformation Day", date: new Date(year, 9, 31) },
    ],
    thuringia: [
      movableHolidays.goodFriday,
      movableHolidays.easterMonday,
      movableHolidays.ascensionDay,
      movableHolidays.whitMonday,
      { name: "Reformation Day", date: new Date(year, 9, 31) },
    ],
  };

  return stateHolidays[state] || [];
}
