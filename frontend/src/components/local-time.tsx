"use client";

/**
 * Renders an ISO date string formatted in the user's browser timezone.
 * suppressHydrationWarning prevents React from flagging the intentional
 * server (UTC) → client (local tz) mismatch on hydration.
 */
export function LocalTime({
  iso,
  options,
}: {
  iso: string;
  options?: Intl.DateTimeFormatOptions;
}) {
  return (
    <span suppressHydrationWarning>
      {new Date(iso).toLocaleString("en-US", options)}
    </span>
  );
}
