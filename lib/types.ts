import { Holiday } from "./holidays";

export interface VacationPeriod {
  startDate: Date;
  endDate: Date;
  vacationDays: Date[];
  totalDays: number;
  efficiency?: number;
  includes: { type: string; name?: string }[];
  isCompanyVacation?: boolean;
}

export interface VacationDay {
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
    vacationDays?: string[];
    includes: { type: string; name?: string }[];
    isCompanyVacation: boolean;
    score?: number;
    type?: string;
  }[];
  holidays: { date: string; name: string }[];
  remoteWorkdays: string[];
  companyVacationDays: string[];
  userMandatoryVacationDays: string[];
  userMandatoryDaysCost: number;
}
