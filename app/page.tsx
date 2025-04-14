import VacationPlanner from "@/components/vacation-planner";

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-24">
      <h1 className="text-3xl font-bold mb-6 text-center">
        German Vacation Day Optimizer
      </h1>
      <p className="text-center mb-8 text-muted-foreground">
        Maximize your time off by strategically planning your vacation days
        around holidays
      </p>
      <VacationPlanner />
    </main>
  );
}
