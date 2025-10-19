# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Vacation Day Optimizer** web application built with Next.js 15 (App Router), React 19, TypeScript, and Tailwind CSS. The application helps users optimize their vacation planning by analyzing public holidays, company vacation days, remote workdays, and user preferences to suggest the most efficient vacation periods.

## Commands

### Development
```bash
npm run dev        # Start Next.js dev server with Turbopack
npm run build      # Build for production
npm start          # Start production server
npm run lint       # Run ESLint
```

### Testing
```bash
bun test          # Run tests (uses Bun test runner)
bun test lib/period-strategies.test.ts  # Run specific test file
```

Note: This project uses **Bun** as the test runner (not Jest or Vitest). Test files use `import { describe, test, expect, beforeEach } from "bun:test"`.

## Architecture

### Core Optimization Logic

The vacation optimization system has three main layers:

1. **Vacation Optimizer** (`lib/vacation-optimizer.ts`)
   - Main entry point: `calculateOptimalVacationPlan()`
   - Orchestrates the entire optimization process
   - Handles user constraints (mandatory vacation days, budget)
   - Manages company vacation days and filters results

2. **Period Strategies** (`lib/period-strategies.ts`)
   - Core algorithm: `findOptimalVacationPeriods()`
   - Identifies potential vacation periods (bridges, holiday links, long weekends)
   - Scores periods using weighted criteria (efficiency, length, holidays, remote days)
   - Implements greedy selection with budget constraints
   - Scoring weights can be tuned (EFFICIENCY_WEIGHT, HOLIDAY_INCLUSION_BONUS, etc.)

3. **Date Utilities** (`lib/date-utils.ts`)
   - Helper functions for workday calculations
   - Handles remote workdays and calendar logic

### Key Concepts

- **Vacation Days**: Days that count against the user's vacation budget
- **Days Off**: Total consecutive non-working days (includes weekends, holidays, etc.)
- **Efficiency**: Ratio of total days off to vacation days used
- **Period Types**: "bridge", "holiday-link", "long-weekend", "holiday-bridge"
- **Company Vacation Days**: Mandatory company-wide vacation periods (cost vacation days)
- **User Mandatory Days**: User-specified dates they must take off
- **Remote Workdays**: Days the user works remotely (affect scoring/penalties)

### State Management

The application uses React hooks for state management (no Redux/Zustand). The main form component `vacation-planner.tsx` manages:
- Country/subdivision selection
- Year and vacation budget
- Workday configuration (M-F by default)
- Remote workdays, company vacation days, user mandatory days
- Results display via `vacation-results.tsx`

### Data Flow

1. User inputs settings in `vacation-planner.tsx`
2. Public holidays fetched from Nager.Date API (`lib/holidays.ts`)
3. `calculateOptimalVacationPlan()` called with all parameters
4. Optimization runs via `findOptimalVacationPeriods()`
5. Results returned as `VacationPlan` interface
6. Displayed in `vacation-results.tsx` with calendar visualization

### UI Components

- Uses **shadcn/ui** components (`components/ui/`)
- Built on **Radix UI** primitives
- Styled with Tailwind CSS
- Calendar component uses `react-day-picker`

## Important Implementation Notes

### Date Handling
- All dates internally use UTC to avoid timezone issues
- API dates are parsed as ISO strings and converted to UTC Date objects
- When comparing dates, always use `.toISOString().split("T")[0]` for consistency

### Optimization Algorithm
- Uses a greedy approach with scoring (not exhaustive search)
- Penalizes vacation days on remote workdays (REMOTE_DAY_VACATION_PENALTY)
- Considers next year vacation days with penalties
- Budget constraints enforced during period selection
- Company vacation days are handled separately from optimization

### Testing
- Tests located in `lib/period-strategies.test.ts`
- Focus on core period-finding logic
- Use Bun test syntax, not Jest
- Mock holidays, workdays, and remote days for predictable scenarios

### External Dependencies
- **Nager.Date API**: Free public holiday data (https://date.nager.at/)
- Supports countries with subdivisions (regions/states)
- No API key required

## File Organization

```
app/              # Next.js App Router pages
  page.tsx        # Main vacation planner page
  layout.tsx      # Root layout with analytics
lib/              # Core business logic
  vacation-optimizer.ts      # Main optimization orchestrator
  period-strategies.ts       # Period finding & scoring algorithms
  period-strategies.test.ts  # Test suite
  holidays.ts                # Holiday API integration
  date-utils.ts              # Date/workday utilities
  types.ts                   # TypeScript interfaces
components/
  vacation-planner.tsx       # Main form component
  vacation-results.tsx       # Results display component
  ui/                        # shadcn/ui components
hooks/                       # Custom React hooks
```

## Common Patterns

### Adding New Scoring Criteria
1. Add weight constant at top of `period-strategies.ts`
2. Modify scoring logic in period generation functions
3. Add tests in `period-strategies.test.ts`
4. Document in comments

### Modifying Workday Logic
- Edit functions in `date-utils.ts`
- Update `workdayNumbers` array (0=Sunday, 6=Saturday)
- Consider impact on efficiency calculations

### Adding New Holiday Sources
- Extend `holidays.ts` with new API integration
- Maintain `Holiday` interface structure
- Ensure dates are UTC-normalized
