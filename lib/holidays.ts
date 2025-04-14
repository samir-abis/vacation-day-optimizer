export interface Holiday {
  name: string;
  date: Date;
}

// Interface for the country data received from the Nager.Date API
interface NagerCountry {
  countryCode: string; // e.g., "DE"
  name: string; // e.g., "Germany"
}

// Interface for the Select component options
export interface CountryOption {
  value: string; // Country code (e.g., "DE")
  label: string; // Country name (e.g., "Germany")
}

// List of country codes known to have subdivisions according to Nager.Date website
// Source: https://date.nager.at/Country (checked manually)
export const countriesWithSubdivisions: string[] = [
  "AU",
  "AT",
  "BA",
  "BR",
  "CA",
  "CL",
  "DE",
  "ES",
  "GB",
  "IT",
  "PT",
  "CH",
  "US",
];

/**
 * Fetches the list of available countries from the Nager.Date API.
 * @returns A promise resolving to an array of CountryOption objects or an empty array if fetching fails.
 */
export async function getAvailableCountries(): Promise<CountryOption[]> {
  const apiUrl = "https://date.nager.at/api/v3/AvailableCountries";

  try {
    const response = await fetch(apiUrl, {
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch available countries: ${response.status} ${response.statusText}`
      );
    }

    const countriesData: NagerCountry[] = await response.json();

    // Sort countries alphabetically by name for the dropdown
    countriesData.sort((a, b) => a.name.localeCompare(b.name));

    // Map to the format required by the Select component
    const countryOptions: CountryOption[] = countriesData.map((country) => ({
      value: country.countryCode,
      label: country.name,
    }));

    return countryOptions;
  } catch (error) {
    console.error("Error fetching available countries:", error);
    return [];
  }
}

// Interface for the holiday data received from the Nager.Date API
export interface NagerHoliday {
  date: string; // YYYY-MM-DD
  localName: string;
  name: string; // English name
  countryCode: string;
  fixed: boolean;
  global: boolean; // Is the holiday global for the country?
  counties: string[] | null; // ISO 3166-2 codes if not global
  launchYear: number | null;
  types: string[];
}

/**
 * Fetches public holidays for a given country and year from the Nager.Date API.
 * Returns the full API response objects.
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @param year The year for which to fetch holidays
 * @returns A promise resolving to an array of NagerHoliday objects or an empty array if fetching fails.
 */
export async function getHolidaysFromAPI(
  countryCode: string,
  year: number
): Promise<NagerHoliday[]> {
  if (!countryCode || !year) {
    console.error("Country code and year are required to fetch holidays.");
    return [];
  }

  const apiUrl = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      // Special handling for 404 when a country might be valid but has no holidays for the year
      if (response.status === 404) {
        console.warn(
          `No holidays found for ${countryCode} in ${year} (API returned 404).`
        );
        return []; // Return empty array, not an error
      }
      throw new Error(
        `Failed to fetch holidays: ${response.status} ${response.statusText}`
      );
    }

    const holidaysData: NagerHoliday[] = await response.json();

    // Return the raw data, preserving regional info
    return holidaysData;
  } catch (error) {
    console.error(
      `Error fetching holidays for ${countryCode}, ${year}:`,
      error
    );
    return []; // Return empty array on error
  }
}

// NOTE: The original Holiday interface might need to be defined here or imported
// export interface Holiday {
//   name: string;
//   date: Date;
// }
