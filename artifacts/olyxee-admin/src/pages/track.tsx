import { useEffect, useState, type ComponentType } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import {
  CalendarDays, Check, ChevronDown, Headphones, Mail, MapPin, PackageCheck, Phone, X, XCircle,
  Package, ClipboardCheck, Warehouse, FileCheck, Plane, Ship, Navigation,
  Truck, Clock, Undo2, PackageX,
} from "lucide-react";
import { shipmentExceptionLabel } from "@workspace/order-statuses";

// Newsreader is the serif the app actually loads (see index.html). Lora was
// referenced before but never loaded, so headings silently fell back to Georgia.
const serif = { fontFamily: '"Newsreader", ui-serif, Georgia, serif', fontWeight: 500 };
const mono = { fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace' };

// Pick a meaningful icon for a shipment stage. Matches on the public status
// code first, then falls back to keywords in the human label, so it stays
// sensible for both air and sea flows without knowing every status up front.
function iconForStep(status: string, label: string): ComponentType<{ className?: string }> {
  const t = `${status || ""} ${label || ""}`.toLowerCase();
  const has = (...k: string[]) => k.some((x) => t.includes(x));
  if (has("delivered")) return PackageCheck;
  if (has("out_for_delivery", "out for delivery")) return Truck;
  if (has("customs", "cleared", "clearance")) return FileCheck;
  if (has("vessel", "port", "ocean", "loaded", "sea")) return Ship;
  if (has("air", "flight")) return Plane;
  if (has("transit", "departed", "approaching")) return Navigation;
  if (has("received", "supplier", "warehouse")) return Warehouse;
  if (has("failed")) return PackageX;
  if (has("returned")) return Undo2;
  if (has("cancelled", "canceled")) return XCircle;
  if (has("delayed")) return Clock;
  if (has("confirmed", "created", "pending", "order", "job")) return ClipboardCheck;
  return Package;
}

interface TrackingEvent {
  at: string;
  status: string;
  label: string;
  message: string | null;
  exceptionType: string | null;
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

function eventDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function eventTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function statusExplanation(event: TrackingEvent): string {
  if (event.message?.trim()) return event.message;
  const status = event.status.toLowerCase();
  if (status.includes("confirm")) return "Your shipment has been registered and the logistics team is preparing the next step.";
  if (status.includes("collect") || status.includes("pickup")) return "The cargo has been collected and is now in the care of the logistics team.";
  if (status.includes("warehouse") || status.includes("received")) return "The cargo has been received and checked at the handling facility.";
  if (status.includes("custom")) return "The shipment is going through the required customs process.";
  if (status.includes("transit") || status.includes("depart")) return "The shipment is moving between its origin and destination.";
  if (status.includes("delivery") && !status.includes("delivered")) return "The shipment is with the local delivery team and heading to its final destination.";
  if (status.includes("delivered")) return "The shipment has reached its final destination.";
  if (status.includes("delay") || status.includes("exception")) return "The shipment needs attention. Open this update for the latest available information.";
  return "This update records the latest confirmed activity for your shipment.";
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
  const [openEvent, setOpenEvent] = useState<number | null>(0);

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
          <div><p className="text-sm font-semibold">{data?.business?.name || "Olyxee Logistics"}</p><p className="text-xs text-neutral-500">Shipment tracking</p></div>
        </div>
        <span className="rounded-full bg-white border border-black/5 px-3 py-1.5 text-xs text-neutral-500">Secure shipment page</span>
      </div>

      <div className="w-full max-w-2xl">
        {loading && (
          <div className="bg-white border border-neutral-200 px-8 py-16 text-center">
            <p style={mono} className="text-[11px] tracking-[0.22em] text-neutral-400 uppercase">
              Loading your shipment…
            </p>
          </div>
        )}

        {!loading && error === "missing" && (
          <StateCard
            title="No shipment to track"
            body="This link is missing a tracking code. Please open the link directly from your email."
          />
        )}

        {!loading && error === "notfound" && (
          <StateCard
            title="Shipment not found"
            body={`We couldn't find a shipment for "${code}". Double-check the link from your email, or reply to that email if you need help.`}
          />
        )}

        {!loading && error === "error" && (
          <StateCard
            title="Something went wrong"
            body="We couldn't load this order right now. Please try again in a moment."
          />
        )}

        {!loading && data && (
          <div className="bg-white rounded-[24px] border border-black/[0.06] shadow-[0_16px_48px_rgba(0,0,0,0.07)] overflow-hidden">
            {/* Header */}
            <div className="px-6 sm:px-9 pt-8 pb-7 border-b border-neutral-100">
              <p style={mono} className="text-[11px] tracking-[0.22em] text-neutral-400 uppercase mb-3">
                {data.business?.name ? `${data.business.name} Tracking ID` : "Tracking ID"}
              </p>
              <p style={mono} className="text-lg font-medium text-neutral-900 mb-5">
                {data.trackingId}
              </p>
              <div className="flex items-center gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white" style={{backgroundColor:data.business?.primaryColor || "#171717"}}>
                  {(() => { const Icon = iconForStep(data.currentStatus, data.statusLabel); return <Icon className="h-5 w-5" />; })()}
                </span>
                <h1 style={serif} className="text-[28px] sm:text-[40px] leading-[1.08] tracking-[-0.01em]">
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
                  Job Number: <span className="font-medium text-neutral-700">{data.reference}</span>
                </p>
              )}
              {data.estimatedDeliveryDate && (
                <div className="mt-5 flex items-center gap-3 rounded-2xl bg-neutral-50 px-4 py-3"><CalendarDays className="h-5 w-5 text-neutral-500"/><div><p className="text-xs text-neutral-500">Estimated delivery</p><p className="text-sm font-semibold">{formatDate(data.estimatedDeliveryDate)}</p></div></div>
              )}
              <p className="mt-5 max-w-xl text-sm leading-6 text-neutral-600">
                {data.events[0] ? statusExplanation(data.events[0]) : "Your shipment has been registered. New updates will appear here as they are confirmed."}
              </p>
            </div>

            {/* One interactive journey replaces the old duplicate checklist + history. */}
            <div className="px-6 sm:px-9 py-7">
              <div className="mb-5 flex items-end justify-between gap-4"><div><p style={mono} className="text-[11px] tracking-[0.2em] text-neutral-400 uppercase">Shipment journey</p><h2 className="mt-1 text-lg font-semibold">Updates from the logistics team</h2></div><span className="text-xs text-neutral-400">Select an update for details</span></div>
              {data.events.length === 0 ? (
                <p className="text-sm text-neutral-500">No updates yet. Check back soon.</p>
              ) : (
                <ol className="space-y-2">
                  {data.events.map((e, i) => {
                    const Icon = iconForStep(e.status, e.label);
                    const expanded = openEvent === i;
                    return (
                      <li key={`${e.at}-${i}`} className={`overflow-hidden rounded-2xl border transition-colors ${expanded ? "border-neutral-300 bg-neutral-50" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}>
                        <button type="button" aria-expanded={expanded} onClick={()=>setOpenEvent(expanded?null:i)} className="flex w-full items-center gap-3 p-4 text-left">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{backgroundColor:i===0?(data.business?.primaryColor || "#171717"):"#a3a3a3"}}><Icon className="h-4.5 w-4.5"/></span>
                          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-neutral-900">{e.label}</span><span className="mt-0.5 block text-xs text-neutral-500">{eventDate(e.at)} · {eventTime(e.at)}</span></span>
                          {i===0 && <span className="hidden sm:inline rounded-full bg-neutral-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">Latest</span>}
                          <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${expanded?"rotate-180":""}`}/>
                        </button>
                        {expanded && <div className="border-t border-neutral-200 px-4 pb-4 pt-3 sm:pl-[68px]"><p className="text-sm leading-6 text-neutral-600">{statusExplanation(e)}</p>{e.location&&<p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-neutral-500"><MapPin className="h-3.5 w-3.5"/>{e.location}</p>}{e.exceptionType&&<p className="mt-3 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{shipmentExceptionLabel(e.exceptionType)}</p>}</div>}
                      </li>
                    );
                  })}
                </ol>
              )}
              {data.flow?.find(step=>step.state==="upcoming") && <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 px-4 py-3"><p className="text-xs font-medium uppercase tracking-wider text-neutral-400">What happens next</p><p className="mt-1 text-sm font-semibold text-neutral-700">{data.flow.find(step=>step.state==="upcoming")?.label}</p></div>}
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
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{action === "cancel" ? "Request cancellation" : "Choose another date"}</h2><p className="mt-1 text-sm text-neutral-500">For shipment {data.trackingId}</p></div><button aria-label="Close" onClick={()=>setAction(null)} className="h-9 w-9 rounded-full bg-neutral-100 grid place-items-center"><X className="h-4 w-4"/></button></div>
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
