"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  germanStates,
  getNationalHolidays,
  getRegionalHolidays,
} from "@/lib/holidays";
import {
  calculateOptimalVacationDays,
  VacationPlan,
  CompanyVacationDay,
} from "@/lib/vacation-optimizer";
import VacationResults from "./vacation-results";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SelectSingleEventHandler } from "react-day-picker";

// Helper function to get YYYY-MM-DD string based on LOCAL date components
function getLocalISODateString(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return "";
  }
  // Use local components
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0"); // Months are 0-indexed
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Define types for state
type WorkdayState = {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
};

type DayKey = keyof WorkdayState;

export default function VacationPlanner() {
  const currentYear = new Date().getFullYear();
  const [remainingDays, setRemainingDays] = useState<number>(14);
  const [selectedState, setSelectedState] =
    useState<string>("baden-wurttemberg");
  const [workdays, setWorkdays] = useState<WorkdayState>({
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  });
  const [remoteWorkdays, setRemoteWorkdays] = useState<WorkdayState>({
    monday: false,
    tuesday: true,
    wednesday: false,
    thursday: false,
    friday: true,
    saturday: false,
    sunday: false,
  });
  const [year, setYear] = useState<number>(currentYear);
  const [vacationPlan, setVacationPlan] = useState<VacationPlan | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [considerRemoteWork, setConsiderRemoteWork] = useState<boolean>(true);
  const [companyVacationDays, setCompanyVacationDays] = useState<
    CompanyVacationDay[]
  >([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedDuration, setSelectedDuration] = useState<string>("1");

  const handleWorkdayChange = (day: DayKey) => {
    setWorkdays((prev) => ({
      ...prev,
      [day]: !prev[day],
    }));

    // If a day is not a workday, it can't be a remote workday
    if (!workdays[day]) {
      setRemoteWorkdays((prev) => ({
        ...prev,
        [day]: false,
      }));
    }
  };

  const handleRemoteWorkdayChange = (day: DayKey) => {
    // Only allow changing remote status for workdays
    if (workdays[day]) {
      setRemoteWorkdays((prev) => ({
        ...prev,
        [day]: !prev[day],
      }));
    }
  };

  const addCompanyVacationDay = () => {
    if (!selectedDate) return;

    // Format the date to YYYY-MM-DD string using local date components
    const dateStr = getLocalISODateString(selectedDate);

    // Check if this date is already added
    const exists = companyVacationDays.some((day) => day.date === dateStr);

    if (!exists && dateStr) {
      setCompanyVacationDays([
        ...companyVacationDays,
        {
          date: dateStr,
          duration: Number.parseFloat(selectedDuration),
        },
      ]);
      setSelectedDate(undefined);
    }
  };

  const removeCompanyVacationDay = (dateToRemove: string) => {
    setCompanyVacationDays(
      companyVacationDays.filter((day) => day.date !== dateToRemove)
    );
  };

  const calculateVacationPlan = () => {
    setIsCalculating(true);

    // Get the workdays as array of numbers (0 = Sunday, 1 = Monday, etc.)
    const workdayNumbers = [];
    if (workdays.monday) workdayNumbers.push(1);
    if (workdays.tuesday) workdayNumbers.push(2);
    if (workdays.wednesday) workdayNumbers.push(3);
    if (workdays.thursday) workdayNumbers.push(4);
    if (workdays.friday) workdayNumbers.push(5);
    if (workdays.saturday) workdayNumbers.push(6);
    if (workdays.sunday) workdayNumbers.push(0);

    // Get remote workdays as array of numbers
    const remoteWorkdayNumbers = [];
    if (considerRemoteWork) {
      if (remoteWorkdays.monday) remoteWorkdayNumbers.push(1);
      if (remoteWorkdays.tuesday) remoteWorkdayNumbers.push(2);
      if (remoteWorkdays.wednesday) remoteWorkdayNumbers.push(3);
      if (remoteWorkdays.thursday) remoteWorkdayNumbers.push(4);
      if (remoteWorkdays.friday) remoteWorkdayNumbers.push(5);
      if (remoteWorkdays.saturday) remoteWorkdayNumbers.push(6);
      if (remoteWorkdays.sunday) remoteWorkdayNumbers.push(0);
    }

    // Get holidays for the selected state
    const nationalHolidays = getNationalHolidays(year);
    const stateHolidays = getRegionalHolidays(selectedState, year);
    const allHolidays = [...nationalHolidays, ...stateHolidays];

    // Calculate optimal vacation days
    const result = calculateOptimalVacationDays(
      remainingDays,
      workdayNumbers,
      allHolidays,
      year,
      remoteWorkdayNumbers,
      companyVacationDays,
      selectedState
    );

    console.log(
      "[VacationPlanner] Calculating with remoteWorkdayNumbers:",
      remoteWorkdayNumbers
    );

    setVacationPlan(result);
    setIsCalculating(false);
  };

  // Filter dates to only allow selecting dates in the selected year
  const dateFilter = (date: Date): boolean => {
    return date.getFullYear() !== year;
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="remaining-days">
                Vacation Days Available for Planning
              </Label>
              <Input
                id="remaining-days"
                type="number"
                min="1"
                max="100"
                value={remainingDays}
                onChange={(e) =>
                  setRemainingDays(Number.parseInt(e.target.value) || 0)
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                min={currentYear}
                max="2030"
                value={year}
                onChange={(e) =>
                  setYear(Number.parseInt(e.target.value) || currentYear)
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="state">Federal State</Label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger id="state">
                  <SelectValue placeholder="Select your federal state" />
                </SelectTrigger>
                <SelectContent>
                  {germanStates.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs defaultValue="workdays">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="workdays">Workdays</TabsTrigger>
                <TabsTrigger value="remote">Remote Work</TabsTrigger>
                <TabsTrigger value="company">Company Vacation</TabsTrigger>
              </TabsList>

              <TabsContent value="workdays" className="pt-4">
                <div className="grid gap-2">
                  <Label>Select your workdays</Label>
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(workdays).map(([day, checked]) => (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox
                          id={`workday-${day}`}
                          checked={checked}
                          onCheckedChange={() =>
                            handleWorkdayChange(day as DayKey)
                          }
                        />
                        <Label
                          htmlFor={`workday-${day}`}
                          className="capitalize"
                        >
                          {day}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="remote" className="pt-4">
                <div className="grid gap-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-4">
                      <Checkbox
                        id="consider-remote"
                        checked={considerRemoteWork}
                        onCheckedChange={() =>
                          setConsiderRemoteWork(!considerRemoteWork)
                        }
                      />
                      <Label htmlFor="consider-remote">
                        Consider remote work days during vacation planning
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      When enabled, the optimizer will prioritize taking
                      vacation on non-remote workdays, as you can work remotely
                      while traveling.
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label>Select your remote workdays</Label>
                    <div className="flex flex-wrap gap-4">
                      {Object.entries(remoteWorkdays).map(([day, checked]) => (
                        <div key={day} className="flex items-center space-x-2">
                          <Checkbox
                            id={`remote-${day}`}
                            checked={checked}
                            disabled={!workdays[day as DayKey]}
                            onCheckedChange={() =>
                              handleRemoteWorkdayChange(day as DayKey)
                            }
                          />
                          <Label
                            htmlFor={`remote-${day}`}
                            className={`capitalize ${
                              !workdays[day as DayKey]
                                ? "text-muted-foreground"
                                : ""
                            }`}
                          >
                            {day}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="company" className="pt-4">
                <div className="grid gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add company-mandated vacation days that will be
                      automatically included in your vacation plan.
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <Label
                          htmlFor="company-vacation-date"
                          className="mb-2 block"
                        >
                          Date
                        </Label>
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate as SelectSingleEventHandler}
                          disabled={dateFilter}
                          className="rounded-md border"
                        />
                      </div>
                      <div className="md:w-1/4">
                        <Label
                          htmlFor="company-vacation-duration"
                          className="mb-2 block"
                        >
                          Duration
                        </Label>
                        <Select
                          value={selectedDuration}
                          onValueChange={setSelectedDuration}
                        >
                          <SelectTrigger id="company-vacation-duration">
                            <SelectValue placeholder="Duration" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0.5">Half day (0.5)</SelectItem>
                            <SelectItem value="1">Full day (1.0)</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={addCompanyVacationDay}
                          className="w-full mt-4"
                          disabled={!selectedDate}
                        >
                          Add Company Vacation Day
                        </Button>
                      </div>
                    </div>

                    {companyVacationDays.length > 0 && (
                      <div className="mt-4">
                        <Label className="mb-2 block">
                          Added Company Vacation Days:
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {companyVacationDays.map((day) => (
                            <Badge
                              key={day.date}
                              variant="outline"
                              className="flex items-center gap-1 py-1.5"
                            >
                              {format(new Date(day.date), "MMM d, yyyy")} (
                              {day.duration} day
                              {day.duration !== 1 ? "s" : ""})
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 p-0 ml-1"
                                onClick={() =>
                                  removeCompanyVacationDay(day.date)
                                }
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <Button onClick={calculateVacationPlan} disabled={isCalculating}>
              {isCalculating
                ? "Calculating..."
                : "Calculate Optimal Vacation Days"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {vacationPlan && <VacationResults plan={vacationPlan} />}
    </div>
  );
}
