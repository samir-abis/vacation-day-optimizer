import VacationPlanner from "@/components/vacation-planner";
import type { Metadata } from "next";

// Define metadata for the page
export const metadata: Metadata = {
  title: "Smart Vacation Day Optimizer | Maximize Your Time Off",
  description:
    "Maximize your time off by strategically planning your vacation days around holidays, remote work, and company vacation. Supports multiple countries and regions.",
  openGraph: {
    title: "Smart Vacation Day Optimizer | Maximize Your Time Off",
    description:
      "Strategically plan vacation days around holidays & remote work.",
    url: "https://vacation-day-optimizer.vercel.app/",
    siteName: "Smart Vacation Day Optimizer",
    // Images will be automatically generated by app/opengraph-image.tsx
    // images: [
    //   {
    //     url: "/og-image.png",
    //     width: 1200,
    //     height: 630,
    //     alt: "Smart Vacation Day Optimizer Banner",
    //   },
    // ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Smart Vacation Day Optimizer | Maximize Your Time Off",
    description:
      "Maximize your time off by strategically planning your vacation days around holidays, remote work, and company vacation.",
    // Images will be automatically generated by app/twitter-image.tsx or reused from opengraph-image.tsx
    // images: ["/og-image.png"], // Replace with your actual OG image path in /public
  },
  // Add other relevant metadata fields if needed
  // e.g., icons: { icon: '/favicon.ico' },
};

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-24">
      <div className="relative mb-16">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl -z-10 blur-xl"></div>
        <div className="text-center py-8 px-4 rounded-xl">
          <h1 className="text-4xl font-bold mb-4 text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Maximize Your Time Off
          </h1>
          <p className="text-center mb-8 text-muted-foreground max-w-2xl mx-auto">
            Effortlessly plan your vacation days around public holidays, remote
            work, and company breaks. Get the most out of your time off—wherever
            you are.
          </p>
          <div className="space-y-2 mb-2 text-center">
            <div className="inline-flex items-center gap-2 flex-wrap justify-center">
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                Supports 30+ countries
              </span>
              <span className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-sm">
                Smarter day optimization
              </span>
              <span className="px-3 py-1 bg-accent/10 text-accent rounded-full text-sm">
                Visual calendar insights
              </span>
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                Remote & company days
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
          Open source & made with ❤️. View the code on{" "}
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
            Support the project
          </a>
        </p>
      </footer>
    </main>
  );
}
