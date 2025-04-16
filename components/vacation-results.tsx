"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DayProps } from "react-day-picker";
import { VacationPlan } from "@/lib/types";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  CalendarDays,
  Building,
  Plane,
  ArrowUpDown,
  HelpCircle,
} from "lucide-react";
import { useResponsiveCalendarMonths } from "@/hooks/use-responsive-calendar-months";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

// Define a type for sorting configuration
type SortConfig = {
  key: SortableKeys; // Use the refined SortableKeys type
  direction: "ascending" | "descending";
} | null;

// Define a type for sorting keys explicitly
// Only include keys that are actually sortable in the table
type SortableKeys =
  | "startDate"
  | "endDate"
  | "totalDays"
  | "vacationDaysUsed"
  | "efficiency"
  | "score"
  | "type";

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
    <Card
      className={cn(
        "p-4 border-primary/20 hover:border-primary/30 transition-colors",
        className
      )}
    >
      <div className="text-sm font-medium text-primary/80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {description && (
        <div className="text-xs text-muted-foreground mt-0.5">
          {description}
        </div>
      )}
    </Card>
  );
}

// --- Helper: Map period types to display names ---
const periodTypeDisplayNames: Record<string, string> = {
  bridge: "Gap Bridge",
  "holiday-link": "Holiday Link",
  "long-weekend": "Long Weekend",
  "holiday-bridge": "Holiday Bridge",
};

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
    let hasTooltip = false; // Flag to conditionally render Tooltip

    if (isHoliday) {
      dayClassName = "bg-red-100 text-red-900 hover:bg-red-200";
      tooltipContent =
        holidayNamesByDate[currentLocalISODateString] || "Holiday";
      IconComponent = CalendarDays;
      hasTooltip = true;
    } else if (isCompanyVacationDay) {
      dayClassName = "bg-purple-100 text-purple-900 hover:bg-purple-200";
      tooltipContent = "Company Vacation";
      IconComponent = Building;
      hasTooltip = true;
    } else if (isVacationDay) {
      // Ensure company vacation days are not double-counted visually
      dayClassName = "bg-green-100 text-green-900 hover:bg-green-200";
      tooltipContent = "Planned Vacation";
      IconComponent = Plane;
      hasTooltip = true;
    } else if (isRemoteWorkday) {
      dayClassName = "bg-blue-100 text-blue-900 hover:bg-blue-200";
      tooltipContent = "Remote Workday";
      IconComponent = Briefcase;
      hasTooltip = true;
    }

    const dayElement = (
      <div
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

    // Conditionally wrap with Tooltip if there is content to show
    if (hasTooltip) {
      return (
        <Tooltip delayDuration={100}>
          {" "}
          {/* Optional: add small delay */}
          <TooltipTrigger asChild>{dayElement}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltipContent}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    // Return the plain element if no tooltip is needed
    return dayElement;
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
    // Increase monthWidth estimate to prevent overcrowding
    monthWidth: 360,
    maxMonths: 3, // Still limit to a maximum of 3 months
  });

  // State for sorting the 'All Periods' table
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "score",
    direction: "descending",
  });

  // Memoized sorted data for the table
  const sortedVacationPeriods = useMemo(() => {
    // Use const as sortableItems is not reassigned
    const sortableItems = [...vacationPeriods];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        // Use number type instead of any, as all comparisons are numeric
        let aValue: number;
        let bValue: number;

        if (sortConfig.key === "efficiency") {
          aValue =
            a.vacationDaysUsed > 0 ? a.totalDays / a.vacationDaysUsed : 0;
          bValue =
            b.vacationDaysUsed > 0 ? b.totalDays / b.vacationDaysUsed : 0;
        } else if (
          sortConfig.key === "startDate" ||
          sortConfig.key === "endDate"
        ) {
          aValue = new Date(a[sortConfig.key]).getTime();
          bValue = new Date(b[sortConfig.key]).getTime();
        } else {
          aValue = a[sortConfig.key] as number;
          bValue = b[sortConfig.key] as number;
        }

        // Handle 'type' sorting (string comparison)
        if (sortConfig.key === "type") {
          const typeA = a.type || "";
          const typeB = b.type || "";
          if (typeA < typeB) {
            return sortConfig.direction === "ascending" ? -1 : 1;
          }
          if (typeA > typeB) {
            return sortConfig.direction === "ascending" ? 1 : -1;
          }
          return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [vacationPeriods, sortConfig]);

  // Function to request sorting
  // Use the explicit SortableKeys type for the key parameter
  const requestSort = (key: SortableKeys) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  // Helper to get sort icon
  // Use the explicit SortableKeys type for the key parameter
  const getSortIcon = (key: SortableKeys) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return sortConfig.direction === "ascending" ? (
      <ArrowUpDown className="ml-2 h-4 w-4" /> // Or specific up/down icons
    ) : (
      <ArrowUpDown className="ml-2 h-4 w-4" /> // Or specific up/down icons
    );
  };

  return (
    <div className="space-y-8">
      {/* Results Summary Section - restructured container */}
      {/* Calendar View Section - Fixed structure for responsive months */}
      <div className="rounded-lg border border-primary/10 bg-card text-card-foreground shadow-sm relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 pointer-events-none"></div>

        {/* Content with padding */}
        <div className="relative z-10 p-6">
          <h2 className="text-2xl font-semibold leading-none tracking-tight text-primary mb-4">
            Calendar View
          </h2>
          {/* Legend */}
          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 p-3 bg-card/50 rounded-md border border-primary/10 mb-4">
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

          {/* Wrap Calendar container with TooltipProvider - IMPORTANT: this div needs the ref for responsive sizing */}
          <TooltipProvider>
            <div
              ref={containerRef}
              className="w-full overflow-hidden flex justify-center"
            >
              <Calendar
                mode="multiple"
                selected={parsedRecommendedDays}
                month={currentDisplayMonth}
                onMonthChange={setCurrentDisplayMonth}
                numberOfMonths={numberOfMonths}
                pagedNavigation
                fixedWeeks
                className="rounded-md border border-primary/10 p-3 bg-card text-card-foreground"
                classNames={{
                  months:
                    "flex flex-col items-center sm:flex-row sm:items-start space-y-4 sm:space-x-4 sm:space-y-0",
                  month: "space-y-4",
                  caption_label: "text-base font-medium text-primary",
                  nav_button: "h-8 w-8 text-primary hover:text-primary/80",
                  nav_button_previous: "absolute left-1 top-1",
                  nav_button_next: "absolute right-1 top-1",
                  head_cell:
                    "w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 text-muted-foreground rounded-md font-normal text-[0.8rem]",
                  cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14",
                  day: "h-10 w-10 md:h-12 md:w-12 lg:h-14 lg:w-14 p-0 font-normal aria-selected:opacity-100",
                  day_selected:
                    "bg-transparent text-primary-foreground hover:bg-transparent focus:bg-transparent",
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
          </TooltipProvider>
        </div>
      </div>

      <div className="rounded-lg border border-primary/10 bg-card text-card-foreground shadow-sm relative overflow-hidden">
        {/* Remove the gradient div from inside and place it directly inside the card */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 pointer-events-none"></div>

        {/* All content with padding in a separate div */}
        <div className="relative z-10 p-6">
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold leading-none tracking-tight mb-4 text-primary">
              Your Personalized Vacation Plan
            </h2>
            {/* Summary Statistics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard
                label="Vacation Days Used (Planned)"
                value={optimizedVacationDaysCost}
                description={`From your budget: ${optimizerBudget}`}
              />
              <StatCard
                label="Vacation Days Left"
                value={remainingVacationDays}
              />
              {companyVacationDaysCost > 0 && (
                <StatCard
                  label="Company-Mandated Days"
                  value={companyVacationDaysCost}
                />
              )}
              <StatCard
                label="Total Vacation Days Used"
                value={totalVacationDaysUsed}
                description="Planned + Company Days"
              />
              <StatCard label="Total Days Off" value={totalDaysOff} />
              <StatCard
                label="Time Off per Vacation Day"
                value={efficiency.toFixed(2)}
                description="Days off per vacation day used"
              />
            </div>

            <Separator className="my-6 bg-primary/10" />

            {/* Vacation Periods Section */}
            <div>
              <h3 className="text-xl font-semibold mb-4 text-primary">
                Your Vacation Periods
              </h3>
              <Tabs defaultValue={monthsWithVacations[0]?.toString() || "all"}>
                <TabsList className="mb-4 flex flex-wrap h-auto justify-start bg-secondary/10">
                  <TabsTrigger
                    value="all"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    All Periods
                  </TabsTrigger>
                  {monthsWithVacations.map((month) => (
                    <TabsTrigger
                      key={month}
                      value={month.toString()}
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      {new Date(0, month).toLocaleString("default", {
                        month: "long",
                      })}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="all">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium mb-2">
                      All Planned Vacation Periods
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Periods are ranked by a score balancing efficiency, total
                      break length, and holiday inclusion. Higher scores are
                      prioritized.
                      <br />
                      <span className="italic">
                        Note: Break start/end dates show the full continuous
                        time off, including weekends/holidays, and may appear to
                        overlap. The actual vacation days used are distinct.
                      </span>
                    </p>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => requestSort("startDate")}
                            >
                              <div className="flex items-center">
                                Break Start
                                {getSortIcon("startDate")}
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => requestSort("endDate")}
                            >
                              <div className="flex items-center">
                                Break End
                                {getSortIcon("endDate")}
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer hover:bg-muted/50 text-right"
                              onClick={() => requestSort("totalDays")}
                            >
                              <div className="flex items-center justify-end">
                                Days Off
                                {getSortIcon("totalDays")}
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer hover:bg-muted/50 text-right"
                              onClick={() => requestSort("vacationDaysUsed")}
                            >
                              <div className="flex items-center justify-end">
                                Vacation Days
                                {getSortIcon("vacationDaysUsed")}
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer hover:bg-muted/50 text-right"
                              onClick={() => requestSort("efficiency")}
                            >
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center justify-end">
                                      Efficiency
                                      {getSortIcon("efficiency")}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" align="end">
                                    <p className="max-w-xs text-xs">
                                      Days off per vacation day used. Selection
                                      also considers total length, score, etc.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer hover:bg-muted/50 text-right"
                              onClick={() => requestSort("score")}
                            >
                              <div className="flex items-center justify-end">
                                Score
                                {getSortIcon("score")}
                              </div>
                            </TableHead>
                            <TableHead
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => requestSort("type")}
                            >
                              <div className="flex items-center">
                                Type
                                {getSortIcon("type")}
                              </div>
                            </TableHead>
                            <TableHead>Includes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedVacationPeriods.length > 0 ? (
                            sortedVacationPeriods.map((period, index) => {
                              const efficiency =
                                period.vacationDaysUsed > 0
                                  ? period.totalDays / period.vacationDaysUsed
                                  : 0;
                              const score =
                                period.score !== undefined
                                  ? period.score.toFixed(1)
                                  : "N/A";
                              const type = period.type || "N/A";
                              return (
                                <TableRow key={index}>
                                  <TableCell className="font-medium">
                                    {format(
                                      new Date(period.startDate),
                                      "MMM d, yyyy"
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {format(
                                      new Date(period.endDate),
                                      "MMM d, yyyy"
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {period.totalDays}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-help underline decoration-dotted">
                                            {period.vacationDaysUsed}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="end">
                                          <p className="text-xs font-medium mb-1">
                                            Vacation Days Used:
                                          </p>
                                          <ul className="list-disc pl-4 text-xs">
                                            {(period.vacationDays || []).map(
                                              (day) => (
                                                <li key={day}>
                                                  {format(
                                                    new Date(day),
                                                    "MMM d, yyyy"
                                                  )}
                                                </li>
                                              )
                                            )}
                                          </ul>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {efficiency.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {score}
                                  </TableCell>
                                  <TableCell>
                                    {periodTypeDisplayNames[type] || type}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {period.includes.map((item, i) => (
                                        <Badge
                                          key={i}
                                          variant="secondary"
                                          className={cn(
                                            "font-normal text-xs px-1.5 py-0.5", // Smaller badge
                                            item.type === "holiday" &&
                                              "bg-red-100 text-red-900 border-red-200",
                                            item.type === "company" &&
                                              "bg-purple-100 text-purple-900 border-purple-200",
                                            item.type === "weekend" &&
                                              "bg-gray-100 text-gray-800 border-gray-200"
                                          )}
                                          title={
                                            item.type === "holiday"
                                              ? item.name
                                              : item.type
                                          } // Tooltip for name/type
                                        >
                                          {item.type === "holiday" && (
                                            <CalendarDays className="h-2.5 w-2.5 mr-0.5" />
                                          )}
                                          {item.type === "company" && (
                                            <Building className="h-2.5 w-2.5 mr-0.5" />
                                          )}
                                          {item.type === "weekend"
                                            ? "W/E"
                                            : item.type === "holiday"
                                            ? "Hol"
                                            : "Comp"}
                                        </Badge>
                                      ))}
                                      {period.isCompanyVacation && (
                                        <Badge
                                          variant="outline"
                                          className="bg-purple-100 text-purple-900 border-purple-200 text-xs px-1.5 py-0.5"
                                          title="Company Designated Vacation"
                                        >
                                          <Building className="h-2.5 w-2.5 mr-0.5" />{" "}
                                          Comp
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={8}
                                className="h-24 text-center"
                              >
                                No vacation periods planned.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
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

  // Access score and type directly if they exist on the period object
  const score = period.score !== undefined ? period.score.toFixed(1) : "N/A";
  const type = period.type || "N/A";

  return (
    <Card className="overflow-hidden border-primary/10 hover:border-primary/30 transition-colors relative">
      {/* Gradient div directly inside the card */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 pointer-events-none"></div>

      {/* Content in relative position with z-index */}
      <div className="relative z-10">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            {/* Left Side: Dates & Stats */}
            <div className="flex-1 space-y-1">
              <div className="font-semibold text-lg flex items-center gap-2 flex-wrap">
                <span className="text-primary">
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
                <span
                  className="font-medium text-foreground/80"
                  title={`Score: ${score}`}
                >
                  Efficiency: {efficiency.toFixed(2)}
                </span>
                <span className="mx-1">·</span>
                <span
                  className="font-medium text-foreground/80"
                  title={`Score: ${score}`}
                >
                  Score: {score}
                </span>
                <span className="mx-1">·</span>
                <span className="font-medium text-foreground/80">
                  {/* Use display name in card as well */}
                  Type: {periodTypeDisplayNames[type] || type}
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
      </div>
    </Card>
  );
}
