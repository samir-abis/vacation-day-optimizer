"use client";

import { useState, useEffect, useMemo } from "react";
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
  getHolidaysFromAPI,
  getAvailableCountries,
  CountryOption,
  Holiday,
  countriesWithSubdivisions,
  NagerHoliday,
} from "@/lib/holidays";
import { calculateOptimalVacationDays } from "@/lib/vacation-optimizer";
import { VacationPlan, CompanyVacationDay } from "@/lib/types";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon, Trash2 } from "lucide-react";
import { SelectSingleEventHandler } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

const LOCAL_STORAGE_KEY = "vacationPlannerState_v3";

// --- Helper: Map ISO 3166-2 codes to readable names (Example subset) ---
// This should ideally be more comprehensive or dynamically sourced
const subdivisionCodeToName: Record<string, string> = {
  "DE-BW": "Baden-Württemberg",
  "DE-BY": "Bavaria",
  "DE-BE": "Berlin",
  "DE-BB": "Brandenburg",
  "DE-HB": "Bremen",
  "DE-HH": "Hamburg",
  "DE-HE": "Hesse",
  "DE-MV": "Mecklenburg-Vorpommern",
  "DE-NI": "Lower Saxony",
  "DE-NW": "North Rhine-Westphalia",
  "DE-RP": "Rhineland-Palatinate",
  "DE-SL": "Saarland",
  "DE-SN": "Saxony",
  "DE-ST": "Saxony-Anhalt",
  "DE-SH": "Schleswig-Holstein",
  "DE-TH": "Thuringia",
  "US-CA": "California",
  "US-TX": "Texas",
  "US-FL": "Florida",
  "US-NY": "New York",
  "CA-ON": "Ontario",
  "CA-QC": "Quebec",
  "CA-BC": "British Columbia",
  "GB-ENG": "England",
  "GB-SCT": "Scotland",
  "GB-WLS": "Wales",
  "GB-NIR": "Northern Ireland",
  // Add more as needed
};

// Helper function to safely parse date from string or return undefined
function safeParseDate(
  dateString: string | null | undefined
): Date | undefined {
  if (!dateString) return undefined;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? undefined : date;
}

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

interface VacationPlannerProps {
  onVacationPlanCalculated: (plan: VacationPlan | null) => void;
}

export default function VacationPlanner({ onVacationPlanCalculated }: VacationPlannerProps) {
  const currentYear = new Date().getFullYear();

  // --- State Initialization with Defaults ---
  const [remainingDays, setRemainingDays] = useState<number>(14);
  // -- Country State --
  const [availableCountries, setAvailableCountries] = useState<CountryOption[]>(
    []
  );
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("DE"); // Default to Germany
  const [isFetchingCountries, setIsFetchingCountries] = useState<boolean>(true);
  const [fetchCountriesError, setFetchCountriesError] = useState<string | null>(
    null
  );
  // -- End Country State --
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
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [considerRemoteWork, setConsiderRemoteWork] = useState<boolean>(true);
  const [companyVacationDays, setCompanyVacationDays] = useState<
    CompanyVacationDay[]
  >([]);
  const [selectedCompanyDate, setSelectedCompanyDate] = useState<
    Date | undefined
  >(undefined);
  const [isCompanyCalendarOpen, setIsCompanyCalendarOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [isStartCalendarOpen, setIsStartCalendarOpen] = useState(false);

  // Country & Subdivision State
  const [availableSubdivisions, setAvailableSubdivisions] = useState<
    CountryOption[]
  >([]);
  const [selectedSubdivisionCode, setSelectedSubdivisionCode] = useState<
    string | null
  >(null);

  // Holiday Fetching State
  const [rawHolidays, setRawHolidays] = useState<NagerHoliday[] | null>(null);
  const [isFetchingHolidays, setIsFetchingHolidays] = useState<boolean>(false);
  const [fetchHolidaysError, setFetchHolidaysError] = useState<string | null>(
    null
  );

  const countryHasSubdivisions = useMemo(() => {
    return countriesWithSubdivisions.includes(selectedCountryCode);
  }, [selectedCountryCode]);

  // --- Fetch Available Countries on Mount ---
  useEffect(() => {
    const fetchCountries = async () => {
      setIsFetchingCountries(true);
      setFetchCountriesError(null);
      try {
        const countries = await getAvailableCountries();
        if (countries.length === 0) {
          throw new Error("No countries returned from API.");
        }
        setAvailableCountries(countries);
      } catch (error) {
        console.error("Failed to fetch available countries:", error);
        setFetchCountriesError(
          "Could not load country list. Please try refreshing the page."
        );
      }
      setIsFetchingCountries(false);
    };
    fetchCountries();
  }, []);

  // --- Fetch Holidays & Extract Subdivisions when Country/Year Changes ---
  useEffect(() => {
    if (!selectedCountryCode || !year) return;

    const fetchHolidaysAndSubdivisions = async () => {
      setRawHolidays(null); // Clear previous holidays
      setAvailableSubdivisions([]); // Clear subdivisions
      setSelectedSubdivisionCode(null); // Reset selection
      setFetchHolidaysError(null);

      if (countryHasSubdivisions) {
        setIsFetchingHolidays(true);
        try {
          console.log(
            `Fetching holidays for subdivision country: ${selectedCountryCode}, ${year}`
          );
          const holidays = await getHolidaysFromAPI(selectedCountryCode, year);
          setRawHolidays(holidays);

          // Extract unique subdivisions
          const subdivisionCodes = new Set<string>();
          holidays.forEach((h) => {
            if (!h.global && h.counties) {
              h.counties.forEach((code) => subdivisionCodes.add(code));
            }
          });

          const subdivisions: CountryOption[] = Array.from(subdivisionCodes)
            .map((code) => ({
              value: code,
              label: subdivisionCodeToName[code] || code, // Use mapped name or code
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

          setAvailableSubdivisions(subdivisions);
          console.log(`Found ${subdivisions.length} subdivisions.`);
        } catch (error) {
          console.error("Failed to fetch holidays/subdivisions:", error);
          setFetchHolidaysError("Could not load holiday or subdivision data.");
        }
        setIsFetchingHolidays(false);
      }
    };

    fetchHolidaysAndSubdivisions();
  }, [selectedCountryCode, year, countryHasSubdivisions]); // Rerun when country or year changes

  // --- Load State from localStorage on Mount ---
  useEffect(() => {
    // Ensure countries are loaded before trying to load saved state
    if (isFetchingCountries) return;

    try {
      const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        // Validate and set each piece of state
        if (typeof parsedState.remainingDays === "number")
          setRemainingDays(parsedState.remainingDays);
        // Load country code, ensure it's valid in the fetched list
        if (
          typeof parsedState.selectedCountryCode === "string" &&
          availableCountries.some(
            (c) => c.value === parsedState.selectedCountryCode
          )
        ) {
          setSelectedCountryCode(parsedState.selectedCountryCode);
        } else if (availableCountries.length > 0 && !selectedCountryCode) {
          // If saved country is invalid or missing, default to first available (or keep DE)
          setSelectedCountryCode(availableCountries[0].value);
        }
        if (
          typeof parsedState.workdays === "object" &&
          parsedState.workdays !== null
        )
          setWorkdays(parsedState.workdays);
        if (
          typeof parsedState.remoteWorkdays === "object" &&
          parsedState.remoteWorkdays !== null
        )
          setRemoteWorkdays(parsedState.remoteWorkdays);
        if (typeof parsedState.year === "number") setYear(parsedState.year);
        if (typeof parsedState.considerRemoteWork === "boolean")
          setConsiderRemoteWork(parsedState.considerRemoteWork);
        if (Array.isArray(parsedState.companyVacationDays))
          setCompanyVacationDays(parsedState.companyVacationDays);
        // Load start date, ensuring it's parsed correctly
        if (typeof parsedState.startDate === "string") {
          setStartDate(safeParseDate(parsedState.startDate));
        }
        // Load subdivision *after* potential country load and subdivision fetch
        if (typeof parsedState.selectedSubdivisionCode === "string") {
          // Check if the saved subdivision is valid for the (potentially loaded) country
          if (
            availableSubdivisions.some(
              (s) => s.value === parsedState.selectedSubdivisionCode
            )
          ) {
            setSelectedSubdivisionCode(parsedState.selectedSubdivisionCode);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load state from localStorage:", error);
    }
  }, [isFetchingCountries, availableCountries, availableSubdivisions]); // Add dependencies

  // --- Save State to localStorage on Change ---
  useEffect(() => {
    // Don't save until countries are loaded (ensures valid default is set)
    if (isFetchingCountries) return;

    try {
      const stateToSave = {
        remainingDays,
        selectedCountryCode,
        selectedSubdivisionCode, // Save subdivision
        workdays,
        remoteWorkdays,
        year,
        considerRemoteWork,
        companyVacationDays,
        startDate: startDate ? startDate.toISOString() : undefined,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.error("Failed to save state to localStorage:", error);
    }
  }, [
    // Dependencies: save whenever any of these change
    remainingDays,
    selectedCountryCode, // Changed dependency
    selectedSubdivisionCode, // Added dependency
    workdays,
    remoteWorkdays,
    year,
    considerRemoteWork,
    companyVacationDays,
    startDate,
    isFetchingCountries, // Include to ensure saving happens after load
  ]);

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

  const addCompanyVacationDay = (duration: number) => {
    if (!selectedCompanyDate) return;

    // Format the date to YYYY-MM-DD string using local date components
    const dateStr = getLocalISODateString(selectedCompanyDate);

    // Check if this date is already added
    const exists = companyVacationDays.some((day) => day.date === dateStr);

    if (!exists && dateStr) {
      setCompanyVacationDays([
        ...companyVacationDays,
        {
          date: dateStr,
          duration: duration,
        },
      ]);
      setSelectedCompanyDate(undefined);
    }
  };

  const removeCompanyVacationDay = (dateToRemove: string) => {
    setCompanyVacationDays(
      companyVacationDays.filter((day) => day.date !== dateToRemove)
    );
  };

  const calculateVacationPlan = async () => {
    setIsCalculating(true);
    setCalculationError(null);
    setVacationPlan(null);

    // Basic validation
    if (!selectedCountryCode) {
      setCalculationError("Please select a country.");
      setIsCalculating(false);
      return;
    }
    if (countryHasSubdivisions && !selectedSubdivisionCode) {
      setCalculationError("Please select a region/state for this country.");
      setIsCalculating(false);
      return;
    }

    try {
      let holidaysToProcess: NagerHoliday[] = [];

      // 1. Get Raw Holidays
      if (rawHolidays) {
        // Already fetched if country has subdivisions
        holidaysToProcess = rawHolidays;
      } else {
        // Fetch now for countries without subdivisions
        console.log(
          `Fetching holidays for non-subdivision country: ${selectedCountryCode}, ${year}`
        );
        setIsFetchingHolidays(true);
        setFetchHolidaysError(null);
        holidaysToProcess = await getHolidaysFromAPI(selectedCountryCode, year);
        setIsFetchingHolidays(false);
        if (!holidaysToProcess) {
          throw new Error("Failed to fetch holidays from API.");
        }
      }

      // 2. Filter Holidays by Subdivision (if applicable)
      const filteredHolidays = holidaysToProcess.filter(
        (h) =>
          h.global ||
          (h.counties &&
            selectedSubdivisionCode &&
            h.counties.includes(selectedSubdivisionCode))
      );

      console.log(
        `Using ${
          filteredHolidays.length
        } holidays after filtering for subdivision '${
          selectedSubdivisionCode || "N/A"
        }'`
      );

      // 3. Map to expected Holiday[] format
      const mappedHolidays: Holiday[] = filteredHolidays.map((h) => ({
        name: h.name,
        // Ensure consistent Date object creation (treat as local date)
        date: new Date(`${h.date}T00:00:00`),
      }));

      // 4. Get workdays/remote workdays (same as before)
      const workdayNumbers = [];
      if (workdays.monday) workdayNumbers.push(1);
      if (workdays.tuesday) workdayNumbers.push(2);
      if (workdays.wednesday) workdayNumbers.push(3);
      if (workdays.thursday) workdayNumbers.push(4);
      if (workdays.friday) workdayNumbers.push(5);
      if (workdays.saturday) workdayNumbers.push(6);
      if (workdays.sunday) workdayNumbers.push(0);

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

      // 5. Calculate optimal vacation days using the function with positional parameters
      const plan = await calculateOptimalVacationDays(
        remainingDays,
        workdayNumbers,
        mappedHolidays,
        year,
        considerRemoteWork ? remoteWorkdayNumbers : [],
        companyVacationDays,
        selectedCountryCode,
        startDate
      );

      setVacationPlan(plan);
      
      // Call the callback to pass the result to the parent component
      onVacationPlanCalculated(plan);
      
    } catch (error) {
      console.error("Error during vacation plan calculation:", error);
      setCalculationError(
        `Calculation failed: ${error instanceof Error ? error.message : "Unknown error"}. Please check console for details.`
      );
      // Also call the callback with null to indicate failure
      onVacationPlanCalculated(null);
    }

    setIsCalculating(false);
  };

  // Filter dates to only allow selecting dates in the selected year
  const dateFilter = (date: Date): boolean => {
    return date.getFullYear() !== year;
  };

  // Filter dates for the start date picker: only allow dates in the selected year
  const startDateFilter = (date: Date): boolean => {
    return date.getFullYear() !== year;
  };

  return (
    <div className="space-y-8">
      {/* Configuration Section */}
      <div className="space-y-6 rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <h2 className="text-2xl font-semibold leading-none tracking-tight mb-4">
          Configure Your Vacation Plan
        </h2>

        {fetchCountriesError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error Loading Countries</AlertTitle>
            <AlertDescription>{fetchCountriesError}</AlertDescription>
          </Alert>
        )}

        {fetchHolidaysError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error Loading Holidays</AlertTitle>
            <AlertDescription>{fetchHolidaysError}</AlertDescription>
          </Alert>
        )}

        {/* Initial Settings Group */}
        <div className="space-y-4">
          {/* Row for Budget and Year */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="remaining-days">Vacation Budget</Label>
              <Input
                id="remaining-days"
                type="number"
                min="0"
                max="366"
                value={remainingDays}
                onChange={(e) =>
                  setRemainingDays(Number.parseInt(e.target.value) || 0)
                }
                className="text-center"
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                min={currentYear}
                max={2030}
                value={year}
                onChange={(e) =>
                  setYear(Number.parseInt(e.target.value) || currentYear)
                }
                className="text-center"
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
              />
            </div>
          </div>

          {/* Country (Full Width) */}
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Select
              value={selectedCountryCode}
              onValueChange={setSelectedCountryCode}
              disabled={isFetchingCountries || !!fetchCountriesError}
            >
              <SelectTrigger id="country" className="w-full">
                <SelectValue placeholder="Select country..." />
              </SelectTrigger>
              <SelectContent>
                {isFetchingCountries ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Loading countries...
                  </div>
                ) : (
                  availableCountries.map((country) => (
                    <SelectItem key={country.value} value={country.value}>
                      {country.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Region / State (Conditional, Full Width) */}
          {countryHasSubdivisions && (
            <div className="space-y-2">
              <Label htmlFor="subdivision">Region / State</Label>
              <Select
                value={selectedSubdivisionCode || ""} // Handle null value
                onValueChange={(value) =>
                  setSelectedSubdivisionCode(value || null)
                } // Set back to null if placeholder selected
                disabled={
                  isFetchingHolidays || availableSubdivisions.length === 0
                }
              >
                <SelectTrigger id="subdivision" className="w-full">
                  <SelectValue placeholder="Select region/state..." />
                </SelectTrigger>
                <SelectContent>
                  {isFetchingHolidays ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Loading regions...
                    </div>
                  ) : availableSubdivisions.length === 0 &&
                    !isFetchingHolidays ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      No specific regions found for this country/year.
                    </div>
                  ) : (
                    availableSubdivisions.map((sub) => (
                      <SelectItem key={sub.value} value={sub.value}>
                        {sub.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Start Date Selector */}
        <div className="pt-2">
          <Label htmlFor="start-date">Optimization Start Date (Optional)</Label>
          <Popover
            open={isStartCalendarOpen}
            onOpenChange={(open) => {
              if (open && !startDate) {
                setStartDate(new Date());
              }
              setIsStartCalendarOpen(open);
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                id="start-date"
                className={cn(
                  "w-full justify-start text-left font-normal mt-1",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? (
                  format(startDate, "PPP")
                ) : (
                  <span>Pick a start date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => {
                  setStartDate(date as Date | undefined);
                  setIsStartCalendarOpen(false);
                }}
                disabled={startDateFilter}
                initialFocus
                fixedWeeks
              />
              <div className="p-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => {
                    setStartDate(undefined);
                    setIsStartCalendarOpen(false);
                  }}
                >
                  Clear Start Date
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <p className="text-sm text-muted-foreground mt-1">
            The optimizer will only consider vacation periods starting on or
            after this date.
          </p>
        </div>

        <Separator />

        <Accordion type="multiple" className="w-full space-y-4">
          {/* Workdays Section */}
          <AccordionItem value="workdays">
            <AccordionTrigger className="text-base font-medium">
              Workdays
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="space-y-4">
                <Label>
                  Select your regular working days
                </Label>
                <div className="grid grid-cols-2 gap-4">
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
            </AccordionContent>
          </AccordionItem>

          {/* Remote Work Section */}
          <AccordionItem value="remote">
            <AccordionTrigger className="text-base font-medium">
              Remote Work Options
            </AccordionTrigger>
            <AccordionContent className="pt-4">
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
                  <Label>
                    Select your remote workdays
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Only applicable if the day is also selected as a workday.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
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
            </AccordionContent>
          </AccordionItem>

          {/* Company Vacation Section */}
          <AccordionItem value="company">
            <AccordionTrigger className="text-base font-medium">
              Company Vacation
            </AccordionTrigger>
            <AccordionContent className="pt-4">
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

                <Popover
                  open={isCompanyCalendarOpen}
                  onOpenChange={setIsCompanyCalendarOpen}
                >
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedCompanyDate
                        ? format(selectedCompanyDate, "PPP")
                        : "Add Company Vacation Day"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4 space-y-4">
                    <Calendar
                      mode="single"
                      selected={selectedCompanyDate}
                      onSelect={
                        setSelectedCompanyDate as SelectSingleEventHandler
                      }
                      disabled={dateFilter}
                      initialFocus
                      fixedWeeks
                    />
                    <div className="space-y-2">
                      <Label htmlFor="company-vacation-duration">Duration</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => addCompanyVacationDay(0.5)}
                          disabled={!selectedCompanyDate}
                          variant="outline"
                        >
                          Add Half Day
                        </Button>
                        <Button
                          onClick={() => addCompanyVacationDay(1)}
                          disabled={!selectedCompanyDate}
                        >
                          Add Full Day
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {companyVacationDays.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-base font-medium">Added Days</Label>
                    <div className="rounded-lg border overflow-hidden overflow-x-auto">
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
                            )
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
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Separator />

        {calculationError && (
          <Alert variant="destructive" className="my-4">
            <AlertTitle>Calculation Error</AlertTitle>
            <AlertDescription>{calculationError}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={calculateVacationPlan}
          disabled={
            isCalculating ||
            isFetchingCountries ||
            isFetchingHolidays ||
            !!fetchCountriesError ||
            !!fetchHolidaysError ||
            !selectedCountryCode ||
            (countryHasSubdivisions && !selectedSubdivisionCode)
          }
          className="w-full"
          size="lg"
        >
          {isCalculating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculating...
            </>
          ) : (
            "Calculate Optimal Vacation Plan"
          )}
        </Button>
      </div>

    </div>
  );
}
