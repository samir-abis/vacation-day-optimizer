"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DayProps } from "react-day-picker";
import { VacationPlan } from "@/lib/types";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Briefcase, CalendarDays, Building, Plane } from "lucide-react";
import { useResponsiveCalendarMonths } from "@/hooks/use-responsive-calendar-months";

// Helper function to get YYYY-MM-DD string based on LOCAL date components
function getLocalISODateString(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    // Handle invalid dates if necessary, though react-day-picker should provide valid ones
    return "";
  }
  // Use local components
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0"); // Months are 0-indexed
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper function to get YYYY-MM-DD string based on UTC date components
function getUTCISODateString(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    // Handle invalid dates if necessary
    return "";
  }
  // Use UTC components
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0"); // Months are 0-indexed
  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface VacationResultsProps {
  plan: VacationPlan;
}

// Define a custom interface extending DayProps
interface CustomDayProps extends DayProps {
  className?: string;
}

// Component to display a single statistic
function StatCard({
  label,
  value,
  description,
  className,
}: {
  label: string;
  value: string | number;
  description?: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {description && (
        <div className="text-xs text-muted-foreground mt-0.5">
          {description}
        </div>
      )}
    </Card>
  );
}

export default function VacationResults({ plan }: VacationResultsProps) {
  const {
    recommendedDays,
    totalDaysOff,
    remainingVacationDays,
    vacationPeriods,
    holidays,
    remoteWorkdays,
    companyVacationDays,
    totalVacationDaysUsed,
    companyVacationDaysCost,
    optimizerBudget,
  } = plan;

  console.log(
    "[VacationResults] Received plan.recommendedDays:",
    recommendedDays
  );
  console.log("[VacationResults] Received plan.holidays:", holidays);
  console.log(
    "[VacationResults] Received plan.remoteWorkdays:",
    remoteWorkdays
  );
  console.log(
    "[VacationResults] Received plan.companyVacationDays:",
    companyVacationDays
  );

  // Create Sets of LOCAL ISO date strings for efficient lookup
  const vacationSet = new Set(
    recommendedDays.map((day) => getLocalISODateString(new Date(day)))
  );
  const holidaySet = new Set(
    holidays ? holidays.map((h) => getLocalISODateString(new Date(h.date))) : []
  );
  const remoteSet = new Set(
    remoteWorkdays
      ? remoteWorkdays.map((day) => getLocalISODateString(new Date(day)))
      : []
  );
  const companySet = new Set(
    companyVacationDays
      ? companyVacationDays.map((day) => getLocalISODateString(new Date(day)))
      : []
  );

  console.log(
    "[VacationResults] Created vacationSet (using local dates):",
    Array.from(vacationSet).slice(0, 10)
  );
  console.log(
    "[VacationResults] Created holidaySet (using local dates):",
    Array.from(holidaySet).slice(0, 10)
  );
  console.log(
    "[VacationResults] Created remoteSet (using local dates):",
    Array.from(remoteSet).slice(0, 10)
  );
  console.log(
    "[VacationResults] Created companySet (using local dates):",
    Array.from(companySet)
  ); // Log entire set

  // Store Date objects for calendar's `selected` prop
  const parsedRecommendedDays = recommendedDays.map(
    (day: string) => new Date(day)
  );

  // Get holiday names by LOCAL date string
  const holidayNamesByDate: { [key: string]: string } = {};
  if (holidays) {
    holidays.forEach((h: { date: string; name: string }) => {
      const date = new Date(h.date);
      // Use local date string for lookup
      const dateKey = getLocalISODateString(date);
      holidayNamesByDate[dateKey] = h.name;
    });
  }

  // Calculate cost of optimizer-planned days
  const optimizedVacationDaysCost = Math.max(
    0,
    totalVacationDaysUsed - companyVacationDaysCost
  );

  // Efficiency calculation (based on optimizer-planned days cost)
  const efficiency =
    optimizedVacationDaysCost > 0
      ? totalDaysOff / optimizedVacationDaysCost
      : 0;

  // Group vacation periods by month for the tabs
  const periodsByMonth: { [month: number]: VacationPlan["vacationPeriods"] } =
    {};
  vacationPeriods.forEach((period) => {
    const startDate = new Date(period.startDate);
    const month = startDate.getUTCMonth(); // Use UTC month

    if (!periodsByMonth[month]) {
      periodsByMonth[month] = [];
    }

    periodsByMonth[month].push(period);
  });

  // Get months that have vacation periods
  const monthsWithVacations = Object.keys(periodsByMonth)
    .map(Number)
    .sort((a, b) => a - b);

  // Custom day renderer for the calendar
  const renderDay = (props: CustomDayProps) => {
    const {
      date,
      displayMonth,
      className: propsClassName,
      ...restProps
    } = props;

    // Check if the date is valid. The displayMonth check might be redundant.
    if (!date) {
      // Return a basic div or null if the date is invalid
      return <div className="w-full h-full"></div>;
    }

    // Check if the date is outside the current display month
    const isOutsideMonth = displayMonth.getMonth() !== date.getMonth();

    // Get the LOCAL date string for comparison
    const currentLocalISODateString = getLocalISODateString(date);

    const isHoliday = holidaySet.has(currentLocalISODateString);
    const isVacationDay = vacationSet.has(currentLocalISODateString);
    const isRemoteWorkday = remoteSet.has(currentLocalISODateString);
    const isCompanyVacationDay = companySet.has(currentLocalISODateString);

    let dayClassName = "";
    let tooltipContent = "";
    let IconComponent: React.ElementType | null = null;

    if (isHoliday) {
      dayClassName = "bg-red-100 text-red-900 hover:bg-red-200";
      tooltipContent =
        holidayNamesByDate[currentLocalISODateString] || "Holiday"; // Use local date string for lookup
      IconComponent = CalendarDays;
    } else if (isCompanyVacationDay) {
      dayClassName = "bg-purple-100 text-purple-900 hover:bg-purple-200";
      tooltipContent = "Company Vacation";
      IconComponent = Building;
    } else if (isVacationDay) {
      // Ensure company vacation days are not double-counted visually
      dayClassName = "bg-green-100 text-green-900 hover:bg-green-200";
      tooltipContent = "Planned Vacation";
      IconComponent = Plane;
    } else if (isRemoteWorkday) {
      dayClassName = "bg-blue-100 text-blue-900 hover:bg-blue-200";
      tooltipContent = "Remote Workday";
      IconComponent = Briefcase;
    }

    return (
      <div
        title={tooltipContent} // Simple browser tooltip
        className={cn(
          "flex flex-col items-center justify-center w-full h-14 p-1 text-center relative rounded-md transition-colors",
          dayClassName,
          isOutsideMonth ? "text-muted-foreground opacity-50" : "",
          propsClassName
        )}
      >
        <span className="text-xs font-medium">{date.getDate()}</span>
        {IconComponent && (
          <IconComponent className="h-3.5 w-3.5 mt-0.5 opacity-80" />
        )}
      </div>
    );
  };

  // Determine the initial month for the calendar
  const initialCalendarDate = () => {
    if (plan.vacationPeriods.length > 0) {
      // Use the start date of the first period
      return new Date(plan.vacationPeriods[0].startDate);
    }
    // Default to January of the year derived from the first holiday or current year
    const year =
      plan.holidays && plan.holidays.length > 0
        ? new Date(plan.holidays[0].date).getFullYear()
        : new Date().getFullYear();
    return new Date(year, 0, 1); // January 1st
  };

  // State for the currently displayed month in the calendar
  const [currentDisplayMonth, setCurrentDisplayMonth] = useState(() =>
    initialCalendarDate()
  );

  // Use the hook to get the ref and the calculated number of months
  const { containerRef, numberOfMonths } = useResponsiveCalendarMonths({
    // Optional: Adjust monthWidth estimate if needed (default is 330)
    // monthWidth: 350,
    maxMonths: 3, // Still limit to a maximum of 3 months
  });

  return (
    <div className="space-y-8">
      {/* Results Summary Section */}
      <div className="space-y-6 rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <h2 className="text-2xl font-semibold leading-none tracking-tight mb-4">
          Your Optimal Vacation Plan Summary
        </h2>
        {/* Summary Statistics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Planned Days Used (Budget)"
            value={optimizedVacationDaysCost}
            description={`Budget: ${optimizerBudget}`}
          />
          <StatCard
            label="Remaining Budget Days"
            value={remainingVacationDays}
          />
          {companyVacationDaysCost > 0 && (
            <StatCard
              label="Company Vacation Cost"
              value={companyVacationDaysCost}
            />
          )}
          <StatCard
            label="Total Vacation Cost"
            value={totalVacationDaysUsed}
            description="Planned + Company"
          />
          <StatCard label="Total Days Off" value={totalDaysOff} />
          <StatCard
            label="Efficiency Ratio (Planned)"
            value={efficiency.toFixed(2)}
            description="Days off per planned day"
          />
        </div>

        <Separator />

        {/* Vacation Periods Section */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Vacation Periods</h3>
          <Tabs defaultValue={monthsWithVacations[0]?.toString() || "all"}>
            <TabsList className="mb-4 flex flex-wrap h-auto justify-start">
              <TabsTrigger value="all">All Periods</TabsTrigger>
              {monthsWithVacations.map((month) => (
                <TabsTrigger key={month} value={month.toString()}>
                  {new Date(0, month).toLocaleString("default", {
                    month: "long",
                  })}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">All Vacation Periods</h3>
                {vacationPeriods.map((period, index: number) => (
                  <VacationPeriodCard key={index} period={period} />
                ))}
              </div>
            </TabsContent>

            {monthsWithVacations.map((month) => (
              <TabsContent key={month} value={month.toString()}>
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">
                    {new Date(0, month).toLocaleString("default", {
                      month: "long",
                    })}{" "}
                    Vacation Periods
                  </h3>
                  {periodsByMonth[month].map((period, index: number) => (
                    <VacationPeriodCard key={index} period={period} />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>

      {/* Calendar View Section */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold leading-none tracking-tight">
          Calendar View
        </h2>
        {/* Legend */}
        <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-2">
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 bg-green-100 rounded-sm mr-1.5"></span>
            Planned Vacation
          </div>
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 bg-red-100 rounded-sm mr-1.5"></span>
            Holiday
          </div>
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 bg-blue-100 rounded-sm mr-1.5"></span>
            Remote Work
          </div>
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 bg-purple-100 rounded-sm mr-1.5"></span>
            Company Vacation
          </div>
        </div>
        {/* Container div to measure for responsive months */}
        <div
          ref={containerRef}
          className="w-full overflow-hidden flex justify-center"
        >
          {/* Calendar is now inside the measured container */}
          <Calendar
            mode="multiple"
            selected={parsedRecommendedDays} // Still need selected for potential external interactions
            month={currentDisplayMonth} // Use state for displayed month
            onMonthChange={setCurrentDisplayMonth} // Update state on navigation
            numberOfMonths={numberOfMonths} // Use calculated number of months
            pagedNavigation
            className="rounded-md border p-3 bg-card text-card-foreground shadow-sm" // Apply card-like styling here
            classNames={{
              months:
                "flex flex-col items-center sm:flex-row sm:items-start space-y-4 sm:space-x-4 sm:space-y-0", // Center items vertically (mobile), align start horizontally (desktop)
              month: "space-y-4",
              caption_label: "text-base font-medium",
              nav_button: "h-8 w-8",
              nav_button_previous: "absolute left-1 top-1",
              nav_button_next: "absolute right-1 top-1",
              head_cell:
                "w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 text-muted-foreground rounded-md font-normal text-[0.8rem]",
              cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14",
              day: "h-10 w-10 md:h-12 md:w-12 lg:h-14 lg:w-14 p-0 font-normal aria-selected:opacity-100",
              day_selected:
                "bg-transparent text-primary-foreground hover:bg-transparent focus:bg-transparent", // Let custom renderer handle selected style
              day_today: "bg-accent text-accent-foreground",
              day_outside: "text-muted-foreground opacity-50",
              day_disabled: "text-muted-foreground opacity-50",
              day_range_middle:
                "aria-selected:bg-accent aria-selected:text-accent-foreground",
              day_hidden: "invisible",
            }}
            components={{
              Day: renderDay,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Helper component for vacation period cards
interface VacationPeriodCardProps {
  period: VacationPlan["vacationPeriods"][number];
}

function VacationPeriodCard({ period }: VacationPeriodCardProps) {
  const startDate = new Date(period.startDate);
  const endDate = new Date(period.endDate);

  // Calculate efficiency for this period
  const efficiency =
    period.vacationDaysUsed > 0
      ? period.totalDays / period.vacationDaysUsed
      : 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          {/* Left Side: Dates & Stats */}
          <div className="flex-1 space-y-1">
            <div className="font-semibold text-lg flex items-center gap-2 flex-wrap">
              <span>
                {format(startDate, "MMM d, yyyy")} -{" "}
                {format(endDate, "MMM d, yyyy")}
              </span>
              {period.isCompanyVacation && (
                <Badge
                  variant="outline"
                  className="bg-purple-100 text-purple-900 border-purple-200"
                >
                  <Building className="h-3 w-3 mr-1" /> Company
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {period.totalDays} days off
              </span>
              <span> using </span>
              <span className="font-medium text-foreground">
                {period.vacationDaysUsed} vacation days
              </span>
              <span className="mx-1">·</span>
              <span className="font-medium">
                Efficiency: {efficiency.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Right Side: Included Days Badges */}
          <div className="flex flex-wrap gap-1.5 mt-2 sm:mt-0">
            {period.includes.map((item, i) => (
              <Badge
                key={i}
                variant="secondary"
                className={cn(
                  "font-normal",
                  item.type === "holiday" &&
                    "bg-red-100 text-red-900 border-red-200",
                  item.type === "company" &&
                    "bg-purple-100 text-purple-900 border-purple-200",
                  item.type === "weekend" &&
                    "bg-gray-100 text-gray-800 border-gray-200"
                )}
              >
                {item.type === "holiday" && (
                  <CalendarDays className="h-3 w-3 mr-1" />
                )}
                {item.type === "company" && (
                  <Building className="h-3 w-3 mr-1" />
                )}
                {item.type === "holiday"
                  ? item.name // Show holiday name
                  : item.type === "company"
                  ? "Company Day"
                  : "Weekend"}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
