"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function VacationResults({ plan }) {
  const {
    recommendedDays,
    totalDaysOff,
    remainingVacationDays,
    vacationPeriods,
    holidays,
    remoteWorkdays,
    companyVacationDays,
  } = plan

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())

  // Parse dates
  const parsedRecommendedDays = recommendedDays.map((day) => new Date(day))
  const parsedHolidays = holidays ? holidays.map((h) => new Date(h.date)) : []
  const parsedRemoteWorkdays = remoteWorkdays ? remoteWorkdays.map((day) => new Date(day)) : []
  const parsedCompanyVacationDays = companyVacationDays ? companyVacationDays.map((day) => new Date(day)) : []

  // Get holiday names by date
  const holidayNamesByDate = {}
  if (holidays) {
    holidays.forEach((h) => {
      const date = new Date(h.date)
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      holidayNamesByDate[dateKey] = h.name
    })
  }

  // Calculate efficiency (days off per vacation day used)
  // Exclude company vacation days from the calculation for a more accurate efficiency ratio
  const userSelectedVacationDays = recommendedDays.length - parsedCompanyVacationDays.length
  const efficiency = userSelectedVacationDays > 0 ? totalDaysOff / userSelectedVacationDays : 0

  // Group vacation periods by month for the tabs
  const periodsByMonth = {}
  vacationPeriods.forEach((period) => {
    const startDate = new Date(period.startDate)
    const month = startDate.getMonth()

    if (!periodsByMonth[month]) {
      periodsByMonth[month] = []
    }

    periodsByMonth[month].push(period)
  })

  // Get months that have vacation periods
  const monthsWithVacations = Object.keys(periodsByMonth).map(Number)

  // Function to check if a date is in an array of dates
  const isDateInArray = (date, dateArray) => {
    return dateArray.some(
      (d) =>
        d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate(),
    )
  }

  // Custom day renderer for the calendar
  const renderDay = (props) => {
    // Extract the date and remove displayMonth from props to avoid DOM warnings
    const { date, displayMonth, ...restProps } = props

    if (!date) return null

    // Check if this date is a holiday, vacation day, remote workday, or company vacation day
    const isHoliday = isDateInArray(date, parsedHolidays)
    const isVacationDay = isDateInArray(date, parsedRecommendedDays)
    const isRemoteWorkday = isDateInArray(date, parsedRemoteWorkdays)
    const isCompanyVacationDay = isDateInArray(date, parsedCompanyVacationDays)

    let className = ""
    let holidayName = ""
    let label = ""

    if (isHoliday) {
      className = "bg-red-100 text-red-800 rounded-full"
      // Find the holiday name
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      holidayName = holidayNamesByDate[dateKey] || ""
      label = holidayName
    } else if (isCompanyVacationDay) {
      className = "bg-purple-100 text-purple-800 rounded-full"
      label = "Company"
    } else if (isVacationDay) {
      className = "bg-green-100 text-green-800 rounded-full"
    } else if (isRemoteWorkday) {
      className = "bg-blue-100 text-blue-800 rounded-full"
      label = "Remote"
    }

    return (
      <div {...restProps} className={`relative p-2 ${className} ${restProps.className || ""}`}>
        <span>{date.getDate()}</span>
        {label && (
          <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center overflow-hidden text-ellipsis whitespace-nowrap px-1">
            {label}
          </span>
        )}
      </div>
    )
  }

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
                <div className="text-sm text-muted-foreground">Recommended Vacation Days</div>
                <div className="text-2xl font-bold">{recommendedDays.length}</div>
                {parsedCompanyVacationDays.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    (includes {parsedCompanyVacationDays.length} company vacation days)
                  </div>
                )}
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Total Days Off</div>
                <div className="text-2xl font-bold">{totalDaysOff}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Remaining Vacation Days</div>
                <div className="text-2xl font-bold">{remainingVacationDays}</div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Efficiency Ratio</div>
                <div className="text-2xl font-bold">{efficiency.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">days off per vacation day</div>
                {parsedCompanyVacationDays.length > 0 && (
                  <div className="text-xs text-muted-foreground">(excluding company vacation days)</div>
                )}
              </div>
            </div>

            <Tabs defaultValue={monthsWithVacations[0]?.toString() || "all"}>
              <TabsList className="mb-4 flex flex-wrap">
                <TabsTrigger value="all">All Periods</TabsTrigger>
                {monthsWithVacations.map((month) => (
                  <TabsTrigger key={month} value={month.toString()}>
                    {new Date(0, month).toLocaleString("default", { month: "long" })}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="all">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">All Vacation Periods</h3>
                  {vacationPeriods.map((period, index) => (
                    <VacationPeriodCard key={index} period={period} />
                  ))}
                </div>
              </TabsContent>

              {monthsWithVacations.map((month) => (
                <TabsContent key={month} value={month.toString()}>
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">
                      {new Date(0, month).toLocaleString("default", { month: "long" })} Vacation Periods
                    </h3>
                    {periodsByMonth[month].map((period, index) => (
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
              <span className="inline-block w-3 h-3 bg-green-100 rounded-full mr-1"></span> Vacation Days
            </div>
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 bg-red-100 rounded-full mr-1"></span> Holidays
            </div>
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 bg-blue-100 rounded-full mr-1"></span> Remote Work
            </div>
            <div className="flex items-center">
              <span className="inline-block w-3 h-3 bg-purple-100 rounded-full mr-1"></span> Company Vacation
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <Calendar
              mode="multiple"
              selected={parsedRecommendedDays}
              className="rounded-md border"
              components={{
                Day: renderDay,
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper component for vacation period cards
function VacationPeriodCard({ period }) {
  const startDate = new Date(period.startDate)
  const endDate = new Date(period.endDate)

  // Calculate efficiency for this period
  const efficiency = period.totalDays / period.vacationDaysUsed

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="font-medium flex items-center gap-2">
              {format(startDate, "MMMM d, yyyy")} - {format(endDate, "MMMM d, yyyy")}
              {period.isCompanyVacation && (
                <Badge variant="outline" className="bg-purple-50">
                  Company Vacation
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {period.totalDays} days off ({period.vacationDaysUsed} vacation days used)
              <span className="ml-2 font-medium">Efficiency: {efficiency.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {period.includes.map((item, i) => (
              <Badge
                key={i}
                variant={item.type === "holiday" ? "secondary" : item.type === "company" ? "outline" : "outline"}
                className={item.type === "company" ? "bg-purple-50" : ""}
              >
                {item.type === "holiday"
                  ? `${item.name} (Holiday)`
                  : item.type === "company"
                    ? "Company Vacation"
                    : "Weekend"}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
