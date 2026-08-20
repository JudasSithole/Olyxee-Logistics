import { useEffect, useState } from "react";
import { computeCountdown, orderLoopLaunch, LAUNCH_LABEL } from "@/lib/launch";

interface LaunchCountdownProps {
  // Defaults to the Order Loop launch date (20 Aug 2026, Africa/Johannesburg).
  target?: string;
  className?: string;
  // Compact = inline "12d 04h 33m" string; full = boxed d/h/m/s grid.
  variant?: "compact" | "full";
}

const UNITS: { key: "days" | "hours" | "minutes" | "seconds"; label: string }[] = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
];

// Live-updating countdown to the launch date. Purely presentational - it never
// gates any behaviour, it only informs the user when the launch happens.
export function LaunchCountdown({
  target = orderLoopLaunch.launchDate,
  className = "",
  variant = "full",
}: LaunchCountdownProps) {
  const [countdown, setCountdown] = useState(() => computeCountdown(target));

  useEffect(() => {
    const id = setInterval(() => setCountdown(computeCountdown(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (countdown.isLaunched) {
    return (
      <span className={className} data-testid="launch-countdown-live">
        We&apos;re live!
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <span className={className} data-testid="launch-countdown">
        {countdown.days}d {String(countdown.hours).padStart(2, "0")}h{" "}
        {String(countdown.minutes).padStart(2, "0")}m{" "}
        {String(countdown.seconds).padStart(2, "0")}s
      </span>
    );
  }

  return (
    <div className={className} data-testid="launch-countdown">
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {UNITS.map((u) => (
          <div
            key={u.key}
            className="flex flex-col items-center rounded-xl border border-border bg-card px-2 py-3 sm:px-4 sm:py-4"
          >
            <span className="text-2xl sm:text-4xl font-bold tabular-nums tracking-tight">
              {String(countdown[u.key]).padStart(2, "0")}
            </span>
            <span className="mt-1 text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">
              {u.label}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Launching {LAUNCH_LABEL}
      </p>
    </div>
  );
}
