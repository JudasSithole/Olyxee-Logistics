import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";

const serif = { fontFamily: '"Lora", ui-serif, Georgia, serif', fontWeight: 500 };
const mono = { fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace' };

interface TrackingEvent {
  at: string;
  status: string;
  label: string;
  message: string | null;
  location: string | null;
}

interface FlowStep {
  status: string;
  label: string;
  state: "completed" | "current" | "upcoming";
}

interface TrackingResponse {
  trackingId: string;
  reference: string | null;
  currentStatus: string;
  statusLabel: string;
  transportMode?: string | null;
  transportModeLabel?: string | null;
  flow?: FlowStep[];
  estimatedDeliveryDate: string | null;
  lastUpdated: string;
  events: TrackingEvent[];
}

// Tone per public status enum. Anything unknown falls back to neutral so the
// page never crashes on a status it hasn't seen before.
const STATUS_TONE: Record<string, { dot: string; chip: string }> = {
  pending: { dot: "bg-neutral-400", chip: "bg-neutral-100 text-neutral-700" },
  picked_up: { dot: "bg-blue-500", chip: "bg-blue-50 text-blue-700" },
  in_transit: { dot: "bg-blue-500", chip: "bg-blue-50 text-blue-700" },
  customs: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700" },
  out_for_delivery: { dot: "bg-orange-500", chip: "bg-orange-50 text-orange-700" },
  delivered: { dot: "bg-green-600", chip: "bg-green-50 text-green-700" },
  delayed: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700" },
  failed_delivery: { dot: "bg-red-500", chip: "bg-red-50 text-red-700" },
  returned: { dot: "bg-neutral-500", chip: "bg-neutral-100 text-neutral-700" },
  cancelled: { dot: "bg-red-500", chip: "bg-red-50 text-red-700" },
};

function toneFor(status: string) {
  return STATUS_TONE[status] ?? { dot: "bg-neutral-400", chip: "bg-neutral-100 text-neutral-700" };
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getCode(): string {
  const params = new URLSearchParams(window.location.search);
  // Support both ?code= (the format used in emails) and a trailing path segment.
  const fromQuery = params.get("code") ?? params.get("trackingId") ?? "";
  if (fromQuery) return fromQuery.trim();
  const parts = window.location.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("track");
  if (idx >= 0 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]).trim();
  return "";
}

export default function TrackPage() {
  const [code] = useState(getCode);
  const [data, setData] = useState<TrackingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!code) {
      setError("missing");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    apiFetch<TrackingResponse>(`/api/public/track/${encodeURIComponent(code)}`)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError && err.status === 404 ? "notfound" : "error");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div
      className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col items-center px-4 py-10 sm:py-16"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Brand dateline */}
      <div className="w-full max-w-xl flex items-center justify-between mb-8">
        <span style={mono} className="text-[11px] tracking-[0.22em] text-neutral-500 uppercase">
          Olyxee Logistics
        </span>
        <span style={mono} className="text-[11px] tracking-[0.22em] text-neutral-400 uppercase">
          Order Status
        </span>
      </div>

      <div className="w-full max-w-xl">
        {loading && (
          <div className="bg-white border border-neutral-200 px-8 py-16 text-center">
            <p style={mono} className="text-[11px] tracking-[0.22em] text-neutral-400 uppercase">
              Loading your order…
            </p>
          </div>
        )}

        {!loading && error === "missing" && (
          <StateCard
            title="No order to track"
            body="This link is missing an order code. Please open the link directly from your email."
          />
        )}

        {!loading && error === "notfound" && (
          <StateCard
            title="Order not found"
            body={`We couldn't find an order for "${code}". Double-check the link from your email, or reply to that email if you need help.`}
          />
        )}

        {!loading && error === "error" && (
          <StateCard
            title="Something went wrong"
            body="We couldn't load this order right now. Please try again in a moment."
          />
        )}

        {!loading && data && (
          <div className="bg-white border border-neutral-200 shadow-[6px_6px_0_0_rgba(0,0,0,0.06)]">
            {/* Header */}
            <div className="px-8 pt-8 pb-6 border-b border-dashed border-neutral-300">
              <p style={mono} className="text-[11px] tracking-[0.22em] text-neutral-400 uppercase mb-3">
                Tracking ID
              </p>
              <p style={mono} className="text-lg font-medium text-neutral-900 mb-5">
                {data.trackingId}
              </p>
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${toneFor(data.currentStatus).dot}`} />
                <h1 style={serif} className="text-3xl sm:text-4xl leading-tight">
                  {data.statusLabel}
                </h1>
              </div>
              {data.transportModeLabel && (
                <p style={mono} className="mt-3 inline-block text-[11px] tracking-[0.18em] uppercase text-neutral-500 border border-neutral-300 px-2.5 py-1">
                  {data.transportModeLabel}
                </p>
              )}
              {data.reference && (
                <p className="mt-3 text-sm text-neutral-500">
                  Order reference: <span className="text-neutral-700">{data.reference}</span>
                </p>
              )}
              {data.estimatedDeliveryDate && (
                <p className="mt-1 text-sm text-neutral-500">
                  Estimated delivery:{" "}
                  <span className="text-neutral-700">{formatDate(data.estimatedDeliveryDate)}</span>
                </p>
              )}
            </div>

            {/* Transport-aware journey checklist (logistics orders only) */}
            {data.flow && data.flow.length > 0 && (
              <div className="px-8 py-7 border-b border-dashed border-neutral-300">
                <p style={mono} className="text-[11px] tracking-[0.22em] text-neutral-400 uppercase mb-5">
                  Journey
                </p>
                <ol className="relative">
                  {data.flow.map((step, i) => {
                    const isLast = i === data.flow!.length - 1;
                    return (
                      <li key={step.status} className="relative pl-8 pb-5 last:pb-0">
                        {!isLast && (
                          <span
                            className={`absolute left-[9px] top-5 bottom-0 w-px ${
                              step.state === "completed" ? "bg-green-500" : "bg-neutral-200"
                            }`}
                          />
                        )}
                        {step.state === "completed" && (
                          <span className="absolute left-0 top-0.5 w-[19px] h-[19px] rounded-full bg-green-600 text-white flex items-center justify-center text-[11px] leading-none">
                            ✓
                          </span>
                        )}
                        {step.state === "current" && (
                          <span className="absolute left-0 top-0.5 w-[19px] h-[19px] rounded-full border-2 border-green-600 flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
                          </span>
                        )}
                        {step.state === "upcoming" && (
                          <span className="absolute left-0 top-0.5 w-[19px] h-[19px] rounded-full border-2 border-neutral-300" />
                        )}
                        <span
                          className={`text-sm ${
                            step.state === "current"
                              ? "font-semibold text-neutral-900"
                              : step.state === "completed"
                                ? "text-neutral-700"
                                : "text-neutral-400"
                          }`}
                        >
                          {step.label}
                        </span>
                        {step.state === "current" && (
                          <span style={mono} className="ml-2 text-[10px] tracking-[0.15em] uppercase text-green-700">
                            Current
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {/* Timeline */}
            <div className="px-8 py-7">
              <p style={mono} className="text-[11px] tracking-[0.22em] text-neutral-400 uppercase mb-5">
                History
              </p>
              {data.events.length === 0 ? (
                <p className="text-sm text-neutral-500">No updates yet. Check back soon.</p>
              ) : (
                <ol className="relative">
                  {data.events.map((e, i) => {
                    const tone = toneFor(e.status);
                    const isLast = i === data.events.length - 1;
                    return (
                      <li key={`${e.at}-${i}`} className="relative pl-7 pb-7 last:pb-0">
                        {!isLast && (
                          <span className="absolute left-[5px] top-3 bottom-0 w-px bg-neutral-200" />
                        )}
                        <span className={`absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full ${tone.dot}`} />
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-neutral-900">{e.label}</span>
                          <span style={mono} className="text-[11px] text-neutral-400">
                            {formatDateTime(e.at)}
                          </span>
                        </div>
                        {e.location && (
                          <p className="mt-0.5 text-sm text-neutral-500">{e.location}</p>
                        )}
                        {e.message && (
                          <p className="mt-1 text-sm text-neutral-600">{e.message}</p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-5 bg-neutral-50 border-t border-neutral-200">
              <p style={mono} className="text-[11px] tracking-[0.15em] text-neutral-400 uppercase">
                Last updated {formatDateTime(data.lastUpdated)}
              </p>
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-neutral-400">
          Powered by Olyxee
        </p>
      </div>
    </div>
  );
}

function StateCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white border border-neutral-200 px-8 py-14 text-center">
      <h1 style={serif} className="text-2xl sm:text-3xl mb-3">
        {title}
      </h1>
      <p className="text-sm text-neutral-500 max-w-sm mx-auto leading-relaxed">{body}</p>
    </div>
  );
}
