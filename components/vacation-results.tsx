"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VacationPlan } from "@/lib/vacation-optimizer";
import { DayProps, Day } from "react-day-picker";

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
  const optimizedVacationDaysCost =
    totalVacationDaysUsed - companyVacationDaysCost;

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
      return <div></div>;
    }

    // Get the LOCAL date string for comparison
    const currentLocalISODateString = getLocalISODateString(date);

    const isHoliday = holidaySet.has(currentLocalISODateString);
    const isVacationDay = vacationSet.has(currentLocalISODateString);
    const isRemoteWorkday = remoteSet.has(currentLocalISODateString);
    const isCompanyVacationDay = companySet.has(currentLocalISODateString);

    let dayClassName = "";
    let holidayName = "";
    let label = "";

    if (isHoliday) {
      dayClassName = "bg-red-100 text-red-800";
      holidayName = holidayNamesByDate[currentLocalISODateString] || ""; // Use local date string for lookup
      label = holidayName;
    } else if (isCompanyVacationDay) {
      dayClassName = "bg-purple-100 text-purple-800";
      label = "Company";
    } else if (isVacationDay) {
      // Ensure company vacation days are not double-counted visually
      if (!isCompanyVacationDay) {
        dayClassName = "bg-green-100 text-green-800";
      }
    } else if (isRemoteWorkday) {
      dayClassName = "bg-blue-100 text-blue-800";
      label = "Remote";
    }

    if (label.length > 8) {
      label = label.substring(0, 6) + "...";
    }

    return (
      <div
        {...restProps}
        className={`flex flex-col items-center justify-center w-full h-full p-1 text-center ${dayClassName} ${
          propsClassName || ""
        }`}
      >
        <span className="text-xs">{date.getDate()}</span>
        {label && (
          <span className="text-[9px] text-center mt-0.5 leading-tight break-words max-w-full">
            {label}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Optimal Vacation Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div
              className={`grid grid-cols-1 md:grid-cols-${
                companyVacationDaysCost > 0 ? 6 : 5
              } gap-4`}
            >
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">
                  Planned Days Used (from Budget)
                </div>
                <div className="text-2xl font-bold">
                  {optimizedVacationDaysCost}
                </div>
                <div className="text-xs text-muted-foreground">
                  (Budget: {optimizerBudget})
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">
                  Remaining Days from Planning Budget
                </div>
                <div className="text-2xl font-bold">
                  {remainingVacationDays}
                </div>
              </div>
              {companyVacationDaysCost > 0 && (
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    Company Vacation Cost
                  </div>
                  <div className="text-2xl font-bold">
                    {companyVacationDaysCost}
                  </div>
                </div>
              )}
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">
                  Total Vacation Cost (Planned + Company)
                </div>
                <div className="text-2xl font-bold">
                  {totalVacationDaysUsed}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">
                  Total Days Off
                </div>
                <div className="text-2xl font-bold">{totalDaysOff}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">
                  Efficiency Ratio (Planned Days)
                </div>
                <div className="text-2xl font-bold">
                  {efficiency.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  days off per planned vacation day
                </div>
              </div>
            </div>

            <Tabs defaultValue={monthsWithVacations[0]?.toString() || "all"}>
              <TabsList className="mb-4 flex flex-wrap">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calendar View</CardTitle>
          <div className="text-sm text-muted-foreground flex flex-wrap gap-3">
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 bg-green-100 rounded-full mr-1"></span>{" "}
              Vacation Days
            </div>
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 bg-red-100 rounded-full mr-1"></span>{" "}
              Holidays
            </div>
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 bg-blue-100 rounded-full mr-1"></span>{" "}
              Remote Work
            </div>
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 bg-purple-100 rounded-full mr-1"></span>{" "}
              Company Vacation
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div>
            <Calendar
              mode="multiple"
              selected={parsedRecommendedDays}
              className="rounded-md border w-full"
              classNames={{
                months: "flex flex-col sm:flex-row sm:justify-between w-full",
                month: "space-y-4 flex-1",
                day: "w-full",
                head_cell:
                  "w-full text-center text-muted-foreground rounded-md font-normal text-[0.8rem]",
                cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 flex-1 h-14",
              }}
              components={{
                Day: renderDay,
              }}
            />
          </div>
        </CardContent>
      </Card>
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
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="font-medium flex items-center gap-2">
              {format(startDate, "MMMM d, yyyy")} -{" "}
              {format(endDate, "MMMM d, yyyy")}
              {period.isCompanyVacation && (
                <Badge variant="outline" className="bg-purple-50">
                  Company Vacation
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {period.totalDays} days off ({period.vacationDaysUsed} vacation
              days used)
              <span className="ml-2 font-medium">
                Efficiency: {efficiency.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {period.includes.map(
              (item: { type: string; name?: string }, i: number) => (
                <Badge
                  key={i}
                  variant={
                    item.type === "holiday"
                      ? "secondary"
                      : item.type === "company"
                      ? "outline"
                      : "outline"
                  }
                  className={item.type === "company" ? "bg-purple-50" : ""}
                >
                  {item.type === "holiday"
                    ? `${item.name} (Holiday)`
                    : item.type === "company"
                    ? "Company Vacation"
                    : "Weekend"}
                </Badge>
              )
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
