import { ImageResponse } from "next/og";

// Image metadata
export const alt = "Smart Vacation Day Optimizer";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Route segment config
export const runtime = "edge"; // Optional: edge runtime for faster response times

// Image generation
export default function Image() {
  // Define colors using Hex for better compatibility with ImageResponse
  const primaryColor = "#2563eb"; // Equivalent to oklch(0.55 0.2 230)
  const accentColor = "#f97316"; // Equivalent to oklch(0.75 0.18 60)
  const textColor = "#FFFFFF"; // Equivalent to oklch(0.985 0 0)

  return new ImageResponse(
    (
      // ImageResponse JSX element
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          // Use Hex colors for the gradient
          background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
          color: textColor,
          fontFamily:
            '"Geist Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          padding: "60px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "80px",
            fontWeight: "bold",
            marginBottom: "30px",
            lineHeight: "1.1",
            // Add a subtle text shadow for better readability
            textShadow: "2px 2px 4px rgba(0, 0, 0, 0.3)", // Slightly stronger shadow
          }}
        >
          Smart Vacation Day Optimizer
        </h1>
        <p
          style={{
            fontSize: "36px",
            opacity: 0.9,
            textShadow: "1px 1px 2px rgba(0, 0, 0, 0.2)", // Slightly stronger shadow
          }}
        >
          Maximize your time off strategically
        </p>
      </div>
    ),
    // ImageResponse options
    {
      // For convenience, we can re-use the exported size config
      ...size,
      // Consider adding custom fonts here if Geist Sans isn't available by default
      // fonts: [
      //   {
      //     name: 'Geist Sans',
      //     // Make sure the path to your font file is correct relative to the project root
      //     data: await fetch(new URL('../../public/fonts/GeistVariableVF.woff2', import.meta.url)).then(res => res.arrayBuffer()),
      //     style: 'normal',
      //     weight: 400,
      //   },
      // ],
    }
  );
}
