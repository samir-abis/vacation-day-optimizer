import { useState, useEffect } from "react";

/**
 * Custom hook to track the state of a CSS media query.
 * @param query The media query string (e.g., '(min-width: 768px)')
 * @returns `true` if the media query matches, `false` otherwise.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    // Ensure this runs only on the client
    if (typeof window === "undefined") {
      return;
    }

    const mediaQueryList = window.matchMedia(query);

    // Set initial state
    setMatches(mediaQueryList.matches);

    // Listener for changes
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener using the recommended addEventListener method
    mediaQueryList.addEventListener("change", listener);

    // Cleanup listener on component unmount
    return () => {
      mediaQueryList.removeEventListener("change", listener);
    };
  }, [query]); // Re-run effect if query string changes

  return matches;
}
