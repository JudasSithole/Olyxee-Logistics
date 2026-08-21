import { format, formatDistanceToNow, isValid } from "date-fns";

type DateValue = string | number | Date | null | undefined;

function validDate(value: DateValue): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? date : null;
}

export function safeFormatDate(value: DateValue, pattern: string, fallback = "Date unavailable") {
  const date = validDate(value);
  return date ? format(date, pattern) : fallback;
}

export function safeTimeAgo(value: DateValue, fallback = "No recent activity") {
  const date = validDate(value);
  return date ? formatDistanceToNow(date, { addSuffix: true }) : fallback;
}

