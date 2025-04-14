"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  germanStates,
  getNationalHolidays,
  getRegionalHolidays,
} from "@/lib/holidays";
import { calculateOptimalVacationDays } from "@/lib/vacation-optimizer";
import { VacationPlan, CompanyVacationDay } from "@/lib/types";
import VacationResults from "./vacation-results";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon, Trash2 } from "lucide-react";
import { SelectSingleEventHandler } from "react-day-picker";
import { cn } from "@/lib/utils";

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
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

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
      setIsCalendarOpen(false); // Close popover after adding
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
      {/* Configuration Section */}
      <div className="space-y-6 rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <h2 className="text-2xl font-semibold leading-none tracking-tight mb-4">
          Configure Your Vacation Plan
        </h2>
        {/* Initial Settings Group */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="remaining-days">Vacation Budget</Label>
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
          <div className="space-y-2">
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
          <div className="space-y-2">
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
        </div>

        <Separator />

        <Tabs defaultValue="workdays">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="workdays">Workdays</TabsTrigger>
            <TabsTrigger value="remote">Remote Work</TabsTrigger>
            <TabsTrigger value="company">Company Vacation</TabsTrigger>
          </TabsList>

          {/* Workdays Tab */}
          <TabsContent value="workdays" className="pt-4">
            <div className="space-y-4">
              <Label className="text-base font-medium">
                Select your regular working days
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {Object.entries(workdays).map(([day, checked]) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={`workday-${day}`}
                      checked={checked}
                      onCheckedChange={() => handleWorkdayChange(day as DayKey)}
                    />
                    <Label htmlFor={`workday-${day}`} className="capitalize">
                      {day}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Remote Work Tab */}
          <TabsContent value="remote" className="pt-4">
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="consider-remote"
                    checked={considerRemoteWork}
                    onCheckedChange={() =>
                      setConsiderRemoteWork(!considerRemoteWork)
                    }
                    className="mt-1"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="consider-remote" className="font-medium">
                      Consider remote work days during planning
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Prioritize vacation on non-remote workdays.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-base font-medium">
                  Select your remote workdays
                </Label>
                <p className="text-sm text-muted-foreground">
                  Only applicable if the day is also selected as a workday.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
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

          {/* Company Vacation Tab */}
          <TabsContent value="company" className="pt-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-medium">
                  Mandatory Company Vacation
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add company-mandated vacation days. These will be deducted
                  first and included in the plan.
                </p>
              </div>

              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate
                      ? format(selectedDate, "PPP")
                      : "Add Company Vacation Day"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4 space-y-4">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate as SelectSingleEventHandler}
                    disabled={dateFilter}
                    initialFocus
                  />
                  <div className="space-y-2">
                    <Label htmlFor="company-vacation-duration">Duration</Label>
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
                  </div>
                  <Button
                    onClick={addCompanyVacationDay}
                    disabled={!selectedDate}
                    className="w-full"
                  >
                    Add Day
                  </Button>
                </PopoverContent>
              </Popover>

              {companyVacationDays.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-base font-medium">Added Days</Label>
                  {/* Use Card styling for the table container */}
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-center">
                            Duration
                          </TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companyVacationDays
                          .sort(
                            (a, b) =>
                              new Date(a.date).getTime() -
                              new Date(b.date).getTime()
                          ) // Sort days chronologically
                          .map((day) => (
                            <TableRow key={day.date}>
                              <TableCell className="font-medium">
                                {format(new Date(day.date), "PPP")}
                              </TableCell>
                              <TableCell className="text-center">
                                {day.duration} day
                                {day.duration !== 1 ? "s" : ""}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    removeCompanyVacationDay(day.date)
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Remove</span>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        <Button
          onClick={calculateVacationPlan}
          disabled={isCalculating}
          className="w-full"
          size="lg"
        >
          {isCalculating ? "Calculating..." : "Calculate Optimal Vacation Plan"}
        </Button>
      </div>

      {vacationPlan && <VacationResults plan={vacationPlan} />}
    </div>
  );
}
