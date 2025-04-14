"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VacationPlan } from "@/lib/vacation-optimizer";
import { DayProps } from "react-day-picker";

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
  } = plan;

  // Parse dates
  const parsedRecommendedDays = recommendedDays.map(
    (day: string) => new Date(day)
  );
  const parsedHolidays = holidays
    ? holidays.map((h: { date: string; name: string }) => new Date(h.date))
    : [];
  const parsedRemoteWorkdays = remoteWorkdays
    ? remoteWorkdays.map((day: string) => new Date(day))
    : [];
  const parsedCompanyVacationDays = companyVacationDays
    ? companyVacationDays.map((day: string) => new Date(day))
    : [];

  // Get holiday names by date
  const holidayNamesByDate: { [key: string]: string } = {};
  if (holidays) {
    holidays.forEach((h: { date: string; name: string }) => {
      const date = new Date(h.date);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      holidayNamesByDate[dateKey] = h.name;
    });
  }

  // Calculate efficiency (days off per vacation day used)
  // Exclude company vacation days from the calculation for a more accurate efficiency ratio
  const userSelectedVacationDays =
    recommendedDays.length - parsedCompanyVacationDays.length;
  const efficiency =
    userSelectedVacationDays > 0 ? totalDaysOff / userSelectedVacationDays : 0;

  // Group vacation periods by month for the tabs
  const periodsByMonth: { [month: number]: VacationPlan["vacationPeriods"] } =
    {};
  vacationPeriods.forEach((period) => {
    const startDate = new Date(period.startDate);
    const month = startDate.getMonth();

    if (!periodsByMonth[month]) {
      periodsByMonth[month] = [];
    }

    periodsByMonth[month].push(period);
  });

  // Get months that have vacation periods
  const monthsWithVacations = Object.keys(periodsByMonth).map(Number);

  // Function to check if a date is in an array of dates
  const isDateInArray = (date: Date, dateArray: Date[]): boolean => {
    return dateArray.some(
      (d: Date) =>
        d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate()
    );
  };

  // Custom day renderer for the calendar
  const renderDay = (props: CustomDayProps) => {
    const {
      date,
      displayMonth,
      className: propsClassName,
      ...restProps
    } = props;

    if (!date) return null;

    // Check if this date is a holiday, vacation day, remote workday, or company vacation day
    const isHoliday = isDateInArray(date, parsedHolidays);
    const isVacationDay = isDateInArray(date, parsedRecommendedDays);
    const isRemoteWorkday = isDateInArray(date, parsedRemoteWorkdays);
    const isCompanyVacationDay = isDateInArray(date, parsedCompanyVacationDays);

    let dayClassName = ""; // Renamed to avoid conflict
    let holidayName = "";
    let label = "";

    if (isHoliday) {
      dayClassName = "bg-red-100 text-red-800"; // Removed rounded-full
      // Find the holiday name
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      holidayName = holidayNamesByDate[dateKey] || "";
      label = holidayName;
    } else if (isCompanyVacationDay) {
      dayClassName = "bg-purple-100 text-purple-800"; // Removed rounded-full
      label = "Company";
    } else if (isVacationDay) {
      dayClassName = "bg-green-100 text-green-800"; // Removed rounded-full
    } else if (isRemoteWorkday) {
      dayClassName = "bg-blue-100 text-blue-800"; // Removed rounded-full
      label = "Remote";
    }

    // Ensure label is shortened if too long, but allow more space
    if (label.length > 8) {
      label = label.substring(0, 6) + "...";
    }

    return (
      <div
        {...restProps}
        // Use flex column, center items, text-center, ensure full width/height, add padding
        className={`flex flex-col items-center justify-center w-full h-full p-1 text-center ${dayClassName} ${
          propsClassName || ""
        }`}
      >
        {/* Make date slightly smaller */}
        <span className="text-xs">{date.getDate()}</span>
        {/* Make label small, allow wrapping, center text */}
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">
                  Recommended Vacation Days
                </div>
                <div className="text-2xl font-bold">
                  {recommendedDays.length}
                </div>
                {parsedCompanyVacationDays.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    (includes {parsedCompanyVacationDays.length} company
                    vacation days)
                  </div>
                )}
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">
                  Total Days Off
                </div>
                <div className="text-2xl font-bold">{totalDaysOff}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">
                  Remaining Vacation Days
                </div>
                <div className="text-2xl font-bold">
                  {remainingVacationDays}
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">
                  Efficiency Ratio
                </div>
                <div className="text-2xl font-bold">
                  {efficiency.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  days off per vacation day
                </div>
                {parsedCompanyVacationDays.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    (excluding company vacation days)
                  </div>
                )}
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
