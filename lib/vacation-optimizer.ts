export function calculateOptimalVacationDays(
  remainingVacationDays,
  workdays,
  holidays,
  year,
  remoteWorkdays = [],
  companyVacationDays = [],
) {
  const today = new Date()
  const endOfYear = new Date(year, 11, 31)

  // Set the start date to today if the year is the current year, otherwise January 1st
  const startDate = year === today.getFullYear() ? today : new Date(year, 0, 1)

  // Get all workdays until the end of the year
  const allWorkdays = getAllWorkdays(startDate, endOfYear, workdays)

  // Get all holidays dates
  const holidayDates = holidays.map((h) => h.date.toISOString().split("T")[0])

  // Filter out workdays that are holidays
  const workdaysWithoutHolidays = allWorkdays.filter((day) => !holidayDates.includes(day.toISOString().split("T")[0]))

  // Process company vacation days
  const companyVacationDatesInfo = processCompanyVacationDays(companyVacationDays, workdaysWithoutHolidays)

  // Subtract company vacation days from remaining vacation days
  const adjustedRemainingDays = Math.max(0, remainingVacationDays - companyVacationDatesInfo.totalDays)

  // Group holidays by month for better distribution
  const holidaysByMonth = groupHolidaysByMonth(holidays)

  // Find optimal vacation periods with better distribution
  const vacationPeriods = findOptimalVacationPeriods(
    workdaysWithoutHolidays,
    adjustedRemainingDays,
    holidays,
    workdays,
    holidaysByMonth,
    remoteWorkdays,
    companyVacationDatesInfo.dates,
  )

  // Add company vacation periods to the vacation periods
  const allVacationPeriods = [...vacationPeriods, ...companyVacationDatesInfo.periods]

  // Extract recommended vacation days (both user-selected and company-mandated)
  const recommendedDays = allVacationPeriods.flatMap((period) => period.vacationDays.map((day) => day.toISOString()))

  // Calculate total days off (vacation days + weekends + holidays)
  const totalDaysOff = allVacationPeriods.reduce((sum, period) => sum + period.totalDays, 0)

  // Get all remote workdays for the calendar view
  const remoteWorkdayDates = workdaysWithoutHolidays
    .filter((day) => isRemoteDay(day, remoteWorkdays))
    .map((day) => day.toISOString())

  return {
    recommendedDays,
    totalDaysOff,
    remainingVacationDays: remainingVacationDays - recommendedDays.length,
    vacationPeriods: allVacationPeriods.map((period) => ({
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
      totalDays: period.totalDays,
      vacationDaysUsed: period.vacationDays.length,
      includes: period.includes,
      isCompanyVacation: period.isCompanyVacation || false,
    })),
    holidays: holidays.map((h) => ({
      date: h.date.toISOString(),
      name: h.name,
    })),
    remoteWorkdays: remoteWorkdayDates,
    companyVacationDays: companyVacationDatesInfo.dates.map((d) => d.toISOString()),
  }
}

// Process company vacation days
function processCompanyVacationDays(companyVacationDays, workdays) {
  if (!companyVacationDays || companyVacationDays.length === 0) {
    return { dates: [], totalDays: 0, periods: [] }
  }

  const companyVacationDatesMap = new Map()
  const periods = []
  let totalDays = 0

  // Process each company vacation day
  companyVacationDays.forEach((vacationDay) => {
    const date = new Date(vacationDay.date)
    const duration = vacationDay.duration

    // Check if this date is a workday
    const isWorkdayDate = workdays.some(
      (workday) =>
        workday.getFullYear() === date.getFullYear() &&
        workday.getMonth() === date.getMonth() &&
        workday.getDate() === date.getDate(),
    )

    if (isWorkdayDate) {
      companyVacationDatesMap.set(date.toISOString(), { date, duration })
      totalDays += duration

      // Create a period for this company vacation day
      periods.push({
        startDate: date,
        endDate: date,
        vacationDays: [date],
        totalDays: 1, // Count as 1 day off regardless of duration
        efficiency: 1 / duration,
        includes: [],
        isCompanyVacation: true,
      })
    }
  })

  // Convert map to array of dates
  const dates = Array.from(companyVacationDatesMap.values()).map((info) => info.date)

  return { dates, totalDays, periods }
}

// Helper function to group holidays by month
function groupHolidaysByMonth(holidays) {
  const result = {}

  for (const holiday of holidays) {
    const month = holiday.date.getMonth()
    if (!result[month]) {
      result[month] = []
    }
    result[month].push(holiday)
  }

  return result
}

// Helper function to get all workdays between two dates
function getAllWorkdays(startDate, endDate, workdays) {
  const result = []
  const currentDate = new Date(startDate)

  // Set to the beginning of the day to ensure proper comparison
  currentDate.setHours(0, 0, 0, 0)

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay() // 0 = Sunday, 1 = Monday, etc.

    if (workdays.includes(dayOfWeek)) {
      result.push(new Date(currentDate))
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return result
}

// Helper function to find optimal vacation periods
function findOptimalVacationPeriods(
  workdays,
  remainingVacationDays,
  holidays,
  workdayNumbers,
  holidaysByMonth,
  remoteWorkdays = [],
  companyVacationDays = [],
) {
  const periods = []
  let vacationDaysLeft = remainingVacationDays

  // Sort workdays chronologically
  workdays.sort((a, b) => a - b)

  // First, find strategic "bridge" days around holidays
  const bridgePeriods = findBridgeDays(
    workdays,
    holidays,
    workdayNumbers,
    vacationDaysLeft,
    remoteWorkdays,
    companyVacationDays,
  )

  // Add bridge periods to our result
  for (const period of bridgePeriods) {
    if (vacationDaysLeft >= period.vacationDays.length) {
      periods.push(period)
      vacationDaysLeft -= period.vacationDays.length
    }
  }

  // Next, try to distribute remaining days around holidays in different months
  if (vacationDaysLeft > 0) {
    const distributedPeriods = distributeRemainingDays(
      workdays,
      vacationDaysLeft,
      holidays,
      workdayNumbers,
      holidaysByMonth,
      periods, // Avoid overlapping with already selected periods
      remoteWorkdays,
      companyVacationDays,
    )

    periods.push(...distributedPeriods)
    vacationDaysLeft -= distributedPeriods.reduce((sum, period) => sum + period.vacationDays.length, 0)
  }

  // If we still have vacation days left, add some long weekends
  if (vacationDaysLeft > 0) {
    const longWeekends = createLongWeekends(
      workdays,
      vacationDaysLeft,
      workdayNumbers,
      periods,
      remoteWorkdays,
      companyVacationDays,
    )
    periods.push(...longWeekends)
    vacationDaysLeft -= longWeekends.reduce((sum, period) => sum + period.vacationDays.length, 0)
  }

  return periods
}

// Find bridge days (days between holidays and weekends)
function findBridgeDays(workdays, holidays, workdayNumbers, maxDays, remoteWorkdays = [], companyVacationDays = []) {
  const periods = []
  const holidayDates = holidays.map((h) => h.date.toISOString().split("T")[0])
  const companyVacationDateStrings = companyVacationDays.map((d) => d.toISOString().split("T")[0])

  // Filter out remote workdays and company vacation days - we don't want to use them as vacation days
  const availableWorkdays = workdays.filter((day) => {
    const dateStr = day.toISOString().split("T")[0]
    return !isRemoteDay(day, remoteWorkdays) && !companyVacationDateStrings.includes(dateStr)
  })

  for (let i = 0; i < availableWorkdays.length; i++) {
    const currentDay = availableWorkdays[i]
    const dayBefore = addDays(currentDay, -1)
    const dayAfter = addDays(currentDay, 1)

    const isBeforeWeekendOrHoliday =
      !isWorkday(dayAfter, workdayNumbers) ||
      holidayDates.includes(dayAfter.toISOString().split("T")[0]) ||
      companyVacationDateStrings.includes(dayAfter.toISOString().split("T")[0])

    const isAfterWeekendOrHoliday =
      !isWorkday(dayBefore, workdayNumbers) ||
      holidayDates.includes(dayBefore.toISOString().split("T")[0]) ||
      companyVacationDateStrings.includes(dayBefore.toISOString().split("T")[0])

    if (isBeforeWeekendOrHoliday || isAfterWeekendOrHoliday) {
      // This is a good bridge day
      const startDate = new Date(currentDay)
      let endDate = new Date(currentDay)
      const vacationDays = [new Date(currentDay)]

      // Check if we can extend this bridge
      let j = i + 1
      while (
        j < availableWorkdays.length &&
        vacationDays.length < 3 && // Limit bridge to 3 days max
        isConsecutiveDay(availableWorkdays[j - 1], availableWorkdays[j])
      ) {
        const nextDay = availableWorkdays[j]
        const nextDayAfter = addDays(nextDay, 1)
        const nextDayStr = nextDay.toISOString().split("T")[0]

        // Skip if this is a company vacation day
        if (companyVacationDateStrings.includes(nextDayStr)) {
          j++
          continue
        }

        const isNextDayBeforeWeekendOrHoliday =
          !isWorkday(nextDayAfter, workdayNumbers) ||
          holidayDates.includes(nextDayAfter.toISOString().split("T")[0]) ||
          companyVacationDateStrings.includes(nextDayAfter.toISOString().split("T")[0])

        if (isNextDayBeforeWeekendOrHoliday) {
          vacationDays.push(new Date(nextDay))
          endDate = new Date(nextDay)
          j++
        } else {
          break
        }
      }

      // Calculate the total days off including weekends and holidays
      const totalDays = calculateTotalDaysOff(
        startDate,
        endDate,
        vacationDays,
        holidays,
        workdayNumbers,
        companyVacationDays,
      )

      // Calculate efficiency (days off per vacation day)
      const efficiency = totalDays / vacationDays.length

      // Only add if efficiency is good (more than 1.2 days off per vacation day)
      if (efficiency >= 1.2) {
        periods.push({
          startDate,
          endDate,
          vacationDays,
          totalDays,
          efficiency,
          includes: getIncludedDaysInfo(startDate, endDate, holidays, workdayNumbers, companyVacationDays),
        })
      }

      // Skip the days we've already checked
      i = j - 1
    }
  }

  // Sort by efficiency (best bridges first)
  periods.sort((a, b) => b.efficiency - a.efficiency)

  // Return only the best bridges up to maxDays
  let daysUsed = 0
  const result = []

  for (const period of periods) {
    if (daysUsed + period.vacationDays.length <= maxDays) {
      result.push(period)
      daysUsed += period.vacationDays.length
    }
  }

  return result
}

// Distribute remaining days around holidays in different months
function distributeRemainingDays(
  workdays,
  remainingDays,
  holidays,
  workdayNumbers,
  holidaysByMonth,
  existingPeriods,
  remoteWorkdays = [],
  companyVacationDays = [],
) {
  const periods = []
  let daysLeft = remainingDays
  const companyVacationDateStrings = companyVacationDays.map((d) => d.toISOString().split("T")[0])

  // Filter out remote workdays and company vacation days
  const availableWorkdays = workdays.filter((day) => {
    const dateStr = day.toISOString().split("T")[0]
    return !isRemoteDay(day, remoteWorkdays) && !companyVacationDateStrings.includes(dateStr)
  })

  // Get months with holidays
  const monthsWithHolidays = Object.keys(holidaysByMonth).map(Number)

  // For each month with holidays
  for (const month of monthsWithHolidays) {
    if (daysLeft <= 0) break

    const monthHolidays = holidaysByMonth[month]

    // Skip if no holidays in this month
    if (!monthHolidays || monthHolidays.length === 0) continue

    // Find workdays in this month
    const monthWorkdays = availableWorkdays.filter((day) => day.getMonth() === month)

    // Skip if no workdays in this month
    if (monthWorkdays.length === 0) continue

    // Find days around holidays in this month
    for (const holiday of monthHolidays) {
      if (daysLeft <= 0) break

      const holidayDate = holiday.date

      // Find workdays close to this holiday
      const nearbyWorkdays = monthWorkdays.filter((day) => {
        const diffDays = Math.abs(day - holidayDate) / (1000 * 60 * 60 * 24)
        return diffDays <= 3 // Within 3 days of the holiday
      })

      // Skip if no nearby workdays
      if (nearbyWorkdays.length === 0) continue

      // Check if these days overlap with existing periods
      const nonOverlappingWorkdays = nearbyWorkdays.filter((day) => !isDateInPeriods(day, existingPeriods))

      // Skip if all nearby workdays overlap with existing periods
      if (nonOverlappingWorkdays.length === 0) continue

      // Sort by proximity to holiday
      nonOverlappingWorkdays.sort((a, b) => {
        const diffA = Math.abs(a - holidayDate)
        const diffB = Math.abs(b - holidayDate)
        return diffA - diffB
      })

      // Take up to 2 days around this holiday
      const daysToTake = Math.min(2, daysLeft, nonOverlappingWorkdays.length)
      const selectedDays = nonOverlappingWorkdays.slice(0, daysToTake)

      if (selectedDays.length > 0) {
        // Sort chronologically
        selectedDays.sort((a, b) => a - b)

        const startDate = selectedDays[0]
        const endDate = selectedDays[selectedDays.length - 1]
        const vacationDays = selectedDays.map((day) => new Date(day))

        // Calculate total days off
        const totalDays = calculateTotalDaysOff(
          startDate,
          endDate,
          vacationDays,
          holidays,
          workdayNumbers,
          companyVacationDays,
        )

        periods.push({
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          vacationDays,
          totalDays,
          includes: getIncludedDaysInfo(startDate, endDate, holidays, workdayNumbers, companyVacationDays),
        })

        daysLeft -= selectedDays.length
      }
    }
  }

  return periods
}

// Create long weekends with remaining days
function createLongWeekends(
  workdays,
  remainingDays,
  workdayNumbers,
  existingPeriods,
  remoteWorkdays = [],
  companyVacationDays = [],
) {
  const periods = []
  let daysLeft = remainingDays
  const companyVacationDateStrings = companyVacationDays.map((d) => d.toISOString().split("T")[0])

  // Filter out remote workdays and company vacation days
  const availableWorkdays = workdays.filter((day) => {
    const dateStr = day.toISOString().split("T")[0]
    return !isRemoteDay(day, remoteWorkdays) && !companyVacationDateStrings.includes(dateStr)
  })

  // Find Fridays and Mondays
  const fridays = availableWorkdays.filter((day) => day.getDay() === 5 && !isDateInPeriods(day, existingPeriods))
  const mondays = availableWorkdays.filter((day) => day.getDay() === 1 && !isDateInPeriods(day, existingPeriods))

  // Distribute between Fridays and Mondays
  const fridaysToUse = Math.min(Math.ceil(daysLeft / 2), fridays.length)
  const mondaysToUse = Math.min(daysLeft - fridaysToUse, mondays.length)

  // Add Fridays (for long weekends)
  for (let i = 0; i < fridaysToUse && daysLeft > 0; i++) {
    const friday = fridays[i]
    const startDate = new Date(friday)
    const endDate = new Date(friday)
    const vacationDays = [new Date(friday)]

    // Calculate total days off (Friday + weekend = 3 days)
    const totalDays = 3

    periods.push({
      startDate,
      endDate,
      vacationDays,
      totalDays,
      includes: [{ type: "weekend" }],
    })

    daysLeft--
  }

  // Add Mondays (for long weekends)
  for (let i = 0; i < mondaysToUse && daysLeft > 0; i++) {
    const monday = mondays[i]
    const startDate = new Date(monday)
    const endDate = new Date(monday)
    const vacationDays = [new Date(monday)]

    // Calculate total days off (weekend + Monday = 3 days)
    const totalDays = 3

    periods.push({
      startDate,
      endDate,
      vacationDays,
      totalDays,
      includes: [{ type: "weekend" }],
    })

    daysLeft--
  }

  // If we still have days left, add them to create 4-day weekends
  if (daysLeft > 0) {
    // Find Thursdays and Tuesdays
    const thursdays = availableWorkdays.filter((day) => day.getDay() === 4 && !isDateInPeriods(day, existingPeriods))
    const tuesdays = availableWorkdays.filter((day) => day.getDay() === 2 && !isDateInPeriods(day, existingPeriods))

    // Add Thursday-Friday combinations
    for (let i = 0; i < thursdays.length && daysLeft > 1; i++) {
      const thursday = thursdays[i]
      const friday = addDays(thursday, 1)
      const fridayStr = friday.toISOString().split("T")[0]

      // Check if Friday is a workday and not in existing periods and not a company vacation day
      if (
        isWorkday(friday, workdayNumbers) &&
        !isDateInPeriods(friday, existingPeriods) &&
        !isRemoteDay(friday, remoteWorkdays) &&
        !companyVacationDateStrings.includes(fridayStr)
      ) {
        const startDate = new Date(thursday)
        const endDate = new Date(friday)
        const vacationDays = [new Date(thursday), new Date(friday)]

        // Calculate total days off (Thursday + Friday + weekend = 4 days)
        const totalDays = 4

        periods.push({
          startDate,
          endDate,
          vacationDays,
          totalDays,
          includes: [{ type: "weekend" }],
        })

        daysLeft -= 2
      }
    }

    // Add Monday-Tuesday combinations
    for (let i = 0; i < tuesdays.length && daysLeft > 1; i++) {
      const tuesday = tuesdays[i]
      const monday = addDays(tuesday, -1)
      const mondayStr = monday.toISOString().split("T")[0]

      // Check if Monday is a workday and not in existing periods and not a company vacation day
      if (
        isWorkday(monday, workdayNumbers) &&
        !isDateInPeriods(monday, existingPeriods) &&
        !isRemoteDay(monday, remoteWorkdays) &&
        !companyVacationDateStrings.includes(mondayStr)
      ) {
        const startDate = new Date(monday)
        const endDate = new Date(tuesday)
        const vacationDays = [new Date(monday), new Date(tuesday)]

        // Calculate total days off (weekend + Monday + Tuesday = 4 days)
        const totalDays = 4

        periods.push({
          startDate,
          endDate,
          vacationDays,
          totalDays,
          includes: [{ type: "weekend" }],
        })

        daysLeft -= 2
      }
    }
  }

  return periods
}

// Helper function to check if a date is a remote workday
function isRemoteDay(date, remoteWorkdays) {
  const dayOfWeek = date.getDay()
  return remoteWorkdays.includes(dayOfWeek)
}

// Helper function to check if a date is within any of the periods
function isDateInPeriods(date, periods) {
  const dateStr = date.toISOString().split("T")[0]

  for (const period of periods) {
    for (const vacationDay of period.vacationDays) {
      if (vacationDay.toISOString().split("T")[0] === dateStr) {
        return true
      }
    }
  }

  return false
}

// Helper function to check if a date is a holiday
function isHoliday(date, holidays) {
  const dateStr = date.toISOString().split("T")[0]
  return holidays.some((h) => h.date.toISOString().split("T")[0] === dateStr)
}

// Helper function to check if a date is a company vacation day
function isCompanyVacationDay(date, companyVacationDays) {
  const dateStr = date.toISOString().split("T")[0]
  return companyVacationDays.some((d) => d.toISOString().split("T")[0] === dateStr)
}

// Helper function to check if a date is a workday
function isWorkday(date, workdayNumbers) {
  return workdayNumbers.includes(date.getDay())
}

// Helper function to add days to a date
function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// Helper function to check if two dates are consecutive workdays
function isConsecutiveDay(date1, date2) {
  const diffTime = Math.abs(date2 - date1)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays <= 3 // Allow for weekends in between
}

// Helper function to calculate total days off in a period
function calculateTotalDaysOff(startDate, endDate, vacationDays, holidays, workdayNumbers, companyVacationDays = []) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  let totalDays = 0
  const currentDate = new Date(start)

  while (currentDate <= end) {
    // Count if it's a vacation day, weekend, holiday, or company vacation day
    const isVacation = vacationDays.some(
      (d) => d.toISOString().split("T")[0] === currentDate.toISOString().split("T")[0],
    )
    const isWeekend = !workdayNumbers.includes(currentDate.getDay())
    const isHol = isHoliday(currentDate, holidays)
    const isCompanyVacation = isCompanyVacationDay(currentDate, companyVacationDays)

    if (isVacation || isWeekend || isHol || isCompanyVacation) {
      totalDays++
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return totalDays
}

// Helper function to get information about included days (weekends, holidays, company vacation)
function getIncludedDaysInfo(startDate, endDate, holidays, workdayNumbers, companyVacationDays = []) {
  const includes = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  // Add weekends
  let hasWeekend = false
  const currentDate = new Date(start)

  while (currentDate <= end) {
    if (!workdayNumbers.includes(currentDate.getDay())) {
      hasWeekend = true
      break
    }
    currentDate.setDate(currentDate.getDate() + 1)
  }

  if (hasWeekend) {
    includes.push({ type: "weekend" })
  }

  // Add holidays
  for (const holiday of holidays) {
    const holidayDate = holiday.date
    if (holidayDate >= start && holidayDate <= end) {
      includes.push({
        type: "holiday",
        name: holiday.name,
      })
    }
  }

  // Add company vacation days
  for (const vacationDay of companyVacationDays) {
    const vacationDate = new Date(vacationDay)
    if (vacationDate >= start && vacationDate <= end) {
      includes.push({
        type: "company",
        name: "Company Vacation",
      })
    }
  }

  return includes
}
