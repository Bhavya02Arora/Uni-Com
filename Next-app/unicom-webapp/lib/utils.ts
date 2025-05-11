import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateUTC(isoString: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    ...options,
  });
}

export function formatDateTimeUTC(isoString: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    timeZone: "UTC",
    ...options,
  });
}
