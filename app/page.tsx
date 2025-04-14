import VacationPlanner from "@/components/vacation-planner";

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-24">
      <div className="relative mb-16">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl -z-10 blur-xl"></div>
        <div className="text-center py-8 px-4 rounded-xl">
          <h1 className="text-4xl font-bold mb-4 text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Smart Vacation Day Optimizer
          </h1>
          <p className="text-center mb-8 text-muted-foreground max-w-2xl mx-auto">
            Maximize your time off by strategically planning your vacation days
            around holidays, remote work, and company vacation
          </p>
          <div className="space-y-2 mb-2 text-center">
            <div className="inline-flex items-center gap-2 flex-wrap justify-center">
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                Multiple countries
              </span>
              <span className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-sm">
                Efficiency optimization
              </span>
              <span className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm">
                Calendar visualization
              </span>
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                Remote work integration
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto">
        <VacationPlanner />
      </div>

      <footer className="mt-16 pb-8 text-center text-sm text-muted-foreground">
        <p>
          This is an open source project. View the code on{" "}
          <a
            href="https://github.com/samir-abis/vacation-day-optimizer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 transition-colors"
          >
            GitHub
          </a>
          <span className="mx-2">·</span>
          <a
            href="https://github.com/sponsors/samir-abis"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent/80 transition-colors"
          >
            Sponsor this project
          </a>
        </p>
      </footer>
    </main>
  );
}
