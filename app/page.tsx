"use client";

import { useState } from "react";
import VacationPlanner from "@/components/vacation-planner";
import VacationResults from "@/components/vacation-results";
import { VacationPlan } from "@/lib/types";

export default function Home() {
  const [vacationPlan, setVacationPlan] = useState<VacationPlan | null>(null);

  // Handle vacation plan calculation results from the sidebar
  const handleVacationPlanCalculated = (plan: VacationPlan | null) => {
    setVacationPlan(plan);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Sidebar */}
      <aside className="w-full md:w-1/3 lg:w-1/4 p-4 md:p-8 border-r dark:border-gray-700 overflow-y-auto">
        <VacationPlanner onVacationPlanCalculated={handleVacationPlanCalculated} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        
        {/* Results display or placeholder */}
        {vacationPlan ? (
          <VacationResults plan={vacationPlan} />
        ) : (
          <div className="mt-8 bg-gray-100 dark:bg-gray-800 p-6 rounded-lg">
            <p className="text-center text-muted-foreground">
              Configure your vacation plan in the sidebar and click "Calculate" to see your optimized vacation plan here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
