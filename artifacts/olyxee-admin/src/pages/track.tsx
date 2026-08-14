import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { CalendarDays, Check, Headphones, Mail, PackageCheck, Phone, X, XCircle } from "lucide-react";

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
  business: { name: string; phone: string | null; email: string | null; logoUrl: string | null; primaryColor: string | null } | null;
  selfService: { canCancel: boolean; canReschedule: boolean };
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
  const [action, setAction] = useState<"cancel" | "reschedule" | null>(null);
  const [requestedDate, setRequestedDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  const submitRequest = async () => {
    if (!action || (action === "reschedule" && !requestedDate)) return;
    setSubmitting(true);
    try {
      const response = await apiFetch<{ message: string }>(`/api/public/track/${encodeURIComponent(code)}/requests`, {
        method: "POST",
        body: { type: action, requestedDate: requestedDate || undefined, note: note || undefined },
      });
      setRequestMessage(response.message);
      setAction(null);
      setRequestedDate("");
      setNote("");
    } catch (err) {
      setRequestMessage(err instanceof ApiError ? err.message : "We could not send your request. Please call the business.");
    } finally {
      setSubmitting(false);
    }
  };

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
      className="min-h-screen bg-[#f5f5f7] text-neutral-900 flex flex-col items-center px-4 py-6 sm:py-12"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Brand dateline */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-7">
        <div className="flex items-center gap-3">
          {data?.business?.logoUrl ? <img src={data.business.logoUrl} alt="" className="h-9 w-9 rounded-xl object-contain bg-white border border-black/5" /> : <div className="h-9 w-9 rounded-xl bg-neutral-900 text-white grid place-items-center font-semibold">{data?.business?.name?.[0] || "O"}</div>}
          <div><p className="text-sm font-semibold">{data?.business?.name || "Olyxee Logistics"}</p><p className="text-xs text-neutral-500">Customer tracking</p></div>
        </div>
        <span className="rounded-full bg-white border border-black/5 px-3 py-1.5 text-xs text-neutral-500">Secure order page</span>
      </div>

      <div className="w-full max-w-2xl">
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
          <div className="bg-white rounded-[28px] border border-black/[0.06] shadow-[0_18px_60px_rgba(0,0,0,0.08)] overflow-hidden">
            {/* Header */}
            <div className="px-6 sm:px-9 pt-8 pb-7 border-b border-neutral-100">
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
                <div className="mt-5 flex items-center gap-3 rounded-2xl bg-neutral-50 px-4 py-3"><CalendarDays className="h-5 w-5 text-neutral-500"/><div><p className="text-xs text-neutral-500">Estimated delivery</p><p className="text-sm font-semibold">{formatDate(data.estimatedDeliveryDate)}</p></div></div>
              )}
            </div>

            <div className="px-6 sm:px-9 py-6 border-b border-neutral-100">
              <div className="flex items-start gap-3"><PackageCheck className="h-5 w-5 mt-0.5" style={{ color: data.business?.primaryColor || "#2b2b2b" }}/><div><p className="text-sm font-semibold">What happens next</p><p className="mt-1 text-sm leading-6 text-neutral-500">We’ll update this page as your shipment moves. You don’t need to call for routine status checks.</p></div></div>
            </div>

            {/* Transport-aware journey checklist (logistics orders only) */}
            {data.flow && data.flow.length > 0 && (
              <div className="px-6 sm:px-9 py-7 border-b border-neutral-100">
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
            <div className="px-6 sm:px-9 py-7">
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

            {(data.selfService.canCancel || data.selfService.canReschedule || data.business?.phone || data.business?.email) && (
              <div className="px-6 sm:px-9 py-7 bg-neutral-50 border-t border-neutral-100">
                <div className="flex items-center gap-2 mb-4"><Headphones className="h-4 w-4"/><h2 className="text-sm font-semibold">Need help with this shipment?</h2></div>
                {requestMessage && <div className="mb-4 flex items-start gap-2 rounded-2xl bg-green-50 text-green-800 px-4 py-3 text-sm"><Check className="h-4 w-4 mt-0.5 shrink-0"/>{requestMessage}</div>}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {data.selfService.canReschedule && <button onClick={()=>{setRequestMessage(null);setAction("reschedule");}} className="rounded-2xl bg-white border border-black/[0.07] px-3 py-3 text-sm font-medium hover:bg-neutral-100 flex flex-col items-center gap-2"><CalendarDays className="h-5 w-5"/>Reschedule</button>}
                  {data.selfService.canCancel && <button onClick={()=>{setRequestMessage(null);setAction("cancel");}} className="rounded-2xl bg-white border border-black/[0.07] px-3 py-3 text-sm font-medium hover:bg-red-50 hover:text-red-700 flex flex-col items-center gap-2"><XCircle className="h-5 w-5"/>Cancel</button>}
                  {data.business?.phone && <a href={`tel:${data.business.phone}`} className="rounded-2xl bg-white border border-black/[0.07] px-3 py-3 text-sm font-medium hover:bg-neutral-100 flex flex-col items-center gap-2"><Phone className="h-5 w-5"/>Call</a>}
                  {data.business?.email && <a href={`mailto:${data.business.email}?subject=${encodeURIComponent(`Help with ${data.trackingId}`)}`} className="rounded-2xl bg-white border border-black/[0.07] px-3 py-3 text-sm font-medium hover:bg-neutral-100 flex flex-col items-center gap-2"><Mail className="h-5 w-5"/>Email</a>}
                </div>
                <p className="mt-3 text-xs text-neutral-500">Cancellation and date changes are requests. The business will confirm them with you.</p>
              </div>
            )}

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

      {action && data && <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm p-4 flex items-end sm:items-center justify-center" onMouseDown={(e)=>{if(e.target===e.currentTarget)setAction(null);}}>
        <div className="w-full max-w-md rounded-[26px] bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{action === "cancel" ? "Request cancellation" : "Choose another date"}</h2><p className="mt-1 text-sm text-neutral-500">For order {data.trackingId}</p></div><button aria-label="Close" onClick={()=>setAction(null)} className="h-9 w-9 rounded-full bg-neutral-100 grid place-items-center"><X className="h-4 w-4"/></button></div>
          {action === "cancel" ? <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">This sends a request to the business. Your order remains active until they confirm the cancellation.</div> : <label className="mt-5 block"><span className="text-sm font-medium">Preferred delivery date</span><input type="date" min={new Date().toISOString().slice(0,10)} value={requestedDate} onChange={e=>setRequestedDate(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-neutral-200 px-3 text-sm"/></label>}
          <label className="mt-4 block"><span className="text-sm font-medium">Note <span className="font-normal text-neutral-400">(optional)</span></span><textarea value={note} onChange={e=>setNote(e.target.value.slice(0,500))} rows={3} placeholder={action === "cancel" ? "Tell us why, if you’d like" : "Add delivery instructions"} className="mt-2 w-full rounded-xl border border-neutral-200 p-3 text-sm resize-none"/></label>
          <button onClick={submitRequest} disabled={submitting || (action === "reschedule" && !requestedDate)} className="mt-5 h-12 w-full rounded-xl text-white font-semibold disabled:opacity-40" style={{backgroundColor:data.business?.primaryColor || "#171717"}}>{submitting ? "Sending…" : "Send request"}</button>
        </div>
      </div>}
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
