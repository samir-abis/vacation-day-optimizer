import { useState, useEffect, useRef, RefObject } from "react";

interface ResponsiveMonthsResult {
  containerRef: RefObject<HTMLDivElement | null>;
  numberOfMonths: number;
}

/**
 * A hook to determine the optimal number of calendar months to display
 * based on the width of a container element.
 *
 * @param options - Configuration options.
 * @param options.monthWidth - Estimated width needed per calendar month (default: 330).
 * @param options.maxMonths - Maximum number of months to display (default: 3).
 * @returns An object containing the ref for the container and the calculated number of months.
 */
export function useResponsiveCalendarMonths({
  monthWidth = 330, // Estimated width per month + padding/margin
  maxMonths = 3,
}: {
  monthWidth?: number;
  maxMonths?: number;
} = {}): ResponsiveMonthsResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numberOfMonths, setNumberOfMonths] = useState(1); // Default to 1

  useEffect(() => {
    const containerElement = containerRef.current;
    if (!containerElement) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width;
        // Calculate how many months can fit
        const calculatedMonths = Math.max(
          1,
          Math.floor(containerWidth / monthWidth)
        );
        // Clamp the value to the maximum allowed months
        const finalMonths = Math.min(calculatedMonths, maxMonths);

        setNumberOfMonths(finalMonths);
      }
    });

    resizeObserver.observe(containerElement);

    // Initial calculation in case ResizeObserver doesn't fire immediately
    const initialWidth = containerElement.getBoundingClientRect().width;
    const initialCalculatedMonths = Math.max(
      1,
      Math.floor(initialWidth / monthWidth)
    );
    const initialFinalMonths = Math.min(initialCalculatedMonths, maxMonths);
    setNumberOfMonths(initialFinalMonths);

    return () => {
      resizeObserver.disconnect();
    };
  }, [monthWidth, maxMonths]);

  return { containerRef, numberOfMonths };
}
