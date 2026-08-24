// Transport-aware tracking flows for LOGISTICS businesses.
// Shared by the API server (validation + email labels) and the admin/customer
// UIs (status pickers + timelines), so the flow definitions live in exactly
// one place.
//
// Design note: flows are keyed by transport mode so future modes (ROAD, RAIL,
// MULTIMODAL) can be added by extending TRANSPORT_MODES + LOGISTICS_STATUS_FLOWS
// without touching validation or UI logic.

export const TRANSPORT_MODES = ["AIR", "SEA"] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const TRANSPORT_MODE_LABELS: Record<TransportMode, string> = {
  AIR: "Air Freight",
  SEA: "Sea Freight",
};

export function isTransportMode(value: unknown): value is TransportMode {
  return typeof value === "string" && (TRANSPORT_MODES as readonly string[]).includes(value);
}

// Shipment status codes per mode, in strict shipment order. These describe
// WHERE THE CARGO IS — never anything about invoices/payment (that lives in the
// Job's separate billing_status). ORDER_CONFIRMED leads each flow: a Job is
// created (confirmed) before the cargo is collected.
// VAT & duty stages are customs/import charges on the cargo — a different kind
// of payment from the freight-service invoice, and unrelated to billing_status.
export const LOGISTICS_STATUS_FLOWS: Record<TransportMode, readonly string[]> = {
  AIR: [
    "ORDER_CONFIRMED",
    "COLLECTED_FROM_SUPPLIER",
    "RECEIVED_AT_WAREHOUSE",
    "PREPARING_FOR_SHIPMENT",
    "IN_TRANSIT",
    "ARRIVED_AT_DESTINATION",
    "AWAITING_VAT_DUTY_PAYMENT",
    "VAT_DUTY_PAID",
    "UNDERGOING_CUSTOMS_CLEARANCE",
    "CUSTOMS_CLEARANCE_COMPLETED",
    "DELIVERED_READY_FOR_COLLECTION",
  ],
  SEA: [
    "ORDER_CONFIRMED",
    "COLLECTED_FROM_SUPPLIER",
    "RECEIVED_AT_WAREHOUSE",
    "PREPARING_FOR_SHIPMENT",
    "LOADING",
    "DEPARTED",
    "MID_OCEAN_TRANSIT",
    "ARRIVED_AT_DESTINATION",
    "AWAITING_VAT_DUTY_PAYMENT",
    "VAT_DUTY_PAID",
    "UNDERGOING_CUSTOMS_CLEARANCE",
    "CUSTOMS_CLEARANCE_COMPLETED",
    "DELIVERED_READY_FOR_COLLECTION",
  ],
};

// Cancellation is a terminal EXCEPTION, deliberately kept out of the linear
// flow so it can never be suggested as the automatic "next status".
export const CANCELLED_STATUS = "CANCELLED";

// Maps every retired legacy status code to its closest stage in the new flow.
// Used so an existing Job keeps rendering and continues FORWARD from roughly
// where it already is (never jumps backwards to the start of the flow).
export const LEGACY_STATUS_MAP: Record<string, string> = {
  PENDING_TRACKING_NUMBER: "COLLECTED_FROM_SUPPLIER",
  RECEIVED_FROM_SUPPLIER: "RECEIVED_AT_WAREHOUSE",
  EXPORT_CUSTOMS_CLEARED: "PREPARING_FOR_SHIPMENT",
  LOADED_ONTO_VESSEL: "LOADING",
  VESSEL_DEPARTED: "DEPARTED",
  DEPARTED_IN_TRANSIT: "MID_OCEAN_TRANSIT",
  APPROACHING_DESTINATION_PORT: "MID_OCEAN_TRANSIT",
  VESSEL_ARRIVED: "ARRIVED_AT_DESTINATION",
  IMPORT_CUSTOMS_CLEARANCE: "UNDERGOING_CUSTOMS_CLEARANCE",
  READY_FOR_COLLECTION_DELIVERY: "DELIVERED_READY_FOR_COLLECTION",
  OUT_FOR_DELIVERY: "DELIVERED_READY_FOR_COLLECTION",
  DELIVERED_COLLECTED: "DELIVERED_READY_FOR_COLLECTION",
  DELIVERED: "DELIVERED_READY_FOR_COLLECTION",
};

/** Resolve a (possibly legacy) status to its position in the current flow. */
export function normalizeLogisticsStatus(status: string): string {
  return LEGACY_STATUS_MAP[status] ?? status;
}

// Customer-facing labels. Superset: current codes PLUS every legacy code, so
// existing orders still render friendly labels (never raw enum names).
export const LOGISTICS_STATUS_LABELS: Record<string, string> = {
  ORDER_CONFIRMED: "Job Confirmed",
  COLLECTED_FROM_SUPPLIER: "Shipment Collected from Supplier",
  RECEIVED_AT_WAREHOUSE: "Shipment Received at Warehouse",
  PREPARING_FOR_SHIPMENT: "Preparing for Shipment",
  LOADING: "Loading",
  DEPARTED: "Departed",
  DEPARTED_IN_TRANSIT: "Departed / In Transit",
  IN_TRANSIT: "In Transit",
  ARRIVED_AT_DESTINATION: "Arrived at Destination",
  AWAITING_VAT_DUTY_PAYMENT: "Awaiting VAT & Duty Payment",
  VAT_DUTY_PAID: "VAT & Duty Paid",
  UNDERGOING_CUSTOMS_CLEARANCE: "Shipment Undergoing Customs Clearance",
  CUSTOMS_CLEARANCE_COMPLETED: "Customs Clearance Completed",
  DELIVERED_READY_FOR_COLLECTION: "Delivered / Ready for Collection",
  READY_FOR_COLLECTION_DELIVERY: "Ready for Collection / Delivery",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED_COLLECTED: "Delivered / Collected",
  CANCELLED: "Cancelled",
  // ─── Legacy codes (kept for existing orders) ───
  PENDING_TRACKING_NUMBER: "Pending Tracking Number",
  RECEIVED_FROM_SUPPLIER: "Received from Supplier",
  EXPORT_CUSTOMS_CLEARED: "Export Customs Cleared",
  LOADED_ONTO_VESSEL: "Loaded onto Vessel",
  VESSEL_DEPARTED: "Vessel Departed",
  MID_OCEAN_TRANSIT: "Mid-Ocean Transit",
  APPROACHING_DESTINATION_PORT: "Approaching Destination Port",
  VESSEL_ARRIVED: "Vessel Arrived",
  IMPORT_CUSTOMS_CLEARANCE: "Import Customs Clearance",
  DELIVERED: "Delivered",
};

/** All logistics status codes across every mode (deduped, order not meaningful). */
export const ALL_LOGISTICS_STATUSES: readonly string[] = Array.from(
  new Set(Object.values(LOGISTICS_STATUS_FLOWS).flat()),
);

export function isLogisticsStatus(status: string): boolean {
  return status in LOGISTICS_STATUS_LABELS;
}

export function logisticsStatusLabel(status: string): string {
  return LOGISTICS_STATUS_LABELS[status] ?? status;
}

/** The ordered flow for a mode, or null for unknown modes. */
export function logisticsFlow(mode: string): readonly string[] | null {
  return isTransportMode(mode) ? LOGISTICS_STATUS_FLOWS[mode] : null;
}

/**
 * Is `status` a valid status for orders shipped via `mode`? Accepts CANCELLED
 * (a terminal exception that isn't part of the linear flow).
 */
export function isStatusValidForMode(mode: string, status: string): boolean {
  if (status === CANCELLED_STATUS) return true;
  const flow = logisticsFlow(mode);
  return !!flow && flow.includes(status);
}

/** Terminal check: DELIVERED_COLLECTED and CANCELLED end a shipment (legacy
 * DELIVERED kept for existing orders). */
export function isLogisticsTerminal(status: string): boolean {
  return normalizeLogisticsStatus(status) === "DELIVERED_READY_FOR_COLLECTION" || status === CANCELLED_STATUS;
}

/**
 * The next suggested status for an order in `mode` currently at `current`.
 * Legacy statuses are normalized to their current-flow position first, so an
 * existing shipment always advances forward. Returns null when terminal,
 * genuinely unknown, or the mode is invalid. Never suggests CANCELLED.
 */
export function nextLogisticsStatus(mode: string, current: string): string | null {
  const flow = logisticsFlow(mode);
  if (!flow) return null;
  const idx = flow.indexOf(normalizeLogisticsStatus(current));
  if (idx === -1 || idx >= flow.length - 1) return null;
  return flow[idx + 1];
}

/**
 * Remaining forward statuses after `current` (excluding current, excluding
 * CANCELLED). Legacy statuses are normalized first so operators only see stages
 * ahead of where the shipment already is - never a backwards jump.
 */
export function remainingLogisticsStatuses(mode: string, current: string): string[] {
  const flow = logisticsFlow(mode);
  if (!flow) return [];
  const idx = flow.indexOf(normalizeLogisticsStatus(current));
  if (idx === -1) return [];
  return flow.slice(idx + 1) as string[];
}

/** True when a transport-aware update stays at the current stage or moves
 * forward. CANCELLED is always allowed as a terminal exception. */
export function isForwardLogisticsProgression(mode: string, current: string, target: string): boolean {
  if (target === CANCELLED_STATUS) return true;
  const flow = logisticsFlow(mode);
  if (!flow) return false;
  const currentIndex = flow.indexOf(normalizeLogisticsStatus(current));
  const targetIndex = flow.indexOf(normalizeLogisticsStatus(target));
  return currentIndex >= 0 && targetIndex >= currentIndex;
}

// ─── Customer email copy for logistics statuses ─────────────────────────────
// Keyed by internal code; statusCopy() in index.ts consults this map so
// notification emails show friendly copy, never raw enum names.
export interface LogisticsStatusCopy {
  headline: string;
  intro: string;
  accent: string;
  tone: "positive" | "neutral" | "warning" | "negative";
}

export const LOGISTICS_STATUS_COPY: Record<string, LogisticsStatusCopy> = {
  ORDER_CONFIRMED:               { headline: "Your shipment is confirmed",           intro: "Thank you — your shipment is booked, and we're getting everything ready to move it.",           accent: "#0284c7", tone: "neutral" },
  COLLECTED_FROM_SUPPLIER:       { headline: "We've collected your shipment",        intro: "Your goods have been collected from the supplier and are on their way to our warehouse.",       accent: "#7c3aed", tone: "neutral" },
  RECEIVED_AT_WAREHOUSE:         { headline: "Your shipment is at our warehouse",    intro: "We've received your goods and they're being prepared for the journey ahead.",                   accent: "#7c3aed", tone: "neutral" },
  PREPARING_FOR_SHIPMENT:        { headline: "Preparing your shipment",              intro: "Your goods are being packed and made ready to travel.",                                         accent: "#0ea5e9", tone: "neutral" },
  LOADING:                       { headline: "Loading your shipment",                intro: "Your cargo is being loaded, ready to depart.",                                                  accent: "#2563eb", tone: "positive" },
  DEPARTED_IN_TRANSIT:           { headline: "Your shipment is on its way",          intro: "Your cargo has departed and is in transit to the destination.",                                 accent: "#2563eb", tone: "positive" },
  DEPARTED:                      { headline: "Your shipment has departed",           intro: "Your cargo has departed the origin port and started its sea journey.",                          accent: "#2563eb", tone: "positive" },
  IN_TRANSIT:                    { headline: "Your shipment is on its way",          intro: "Your cargo is in transit to the destination and will arrive soon.",                             accent: "#2563eb", tone: "positive" },
  ARRIVED_AT_DESTINATION:        { headline: "Arrived at the destination",           intro: "Your shipment has reached the destination and will begin customs clearance shortly.",           accent: "#16a34a", tone: "positive" },
  AWAITING_VAT_DUTY_PAYMENT:     { headline: "Awaiting VAT & duty payment",          intro: "Your shipment is held pending VAT and duty owed to customs. We'll let you know as soon as it's settled.", accent: "#d97706", tone: "warning" },
  VAT_DUTY_PAID:                 { headline: "VAT & duty settled",                   intro: "The VAT and duty on your shipment have been paid — customs clearance can now go ahead.",         accent: "#0ea5e9", tone: "positive" },
  UNDERGOING_CUSTOMS_CLEARANCE:  { headline: "Clearing customs",                     intro: "Your shipment is being cleared through customs at the destination.",                            accent: "#d97706", tone: "neutral" },
  CUSTOMS_CLEARANCE_COMPLETED:   { headline: "Customs cleared",                      intro: "Your shipment has cleared customs and is ready for the final leg.",                             accent: "#16a34a", tone: "positive" },
  DELIVERED_READY_FOR_COLLECTION:{ headline: "Your shipment is ready for collection", intro: "Your shipment has reached its final stage and is now delivered / ready for collection.",          accent: "#16a34a", tone: "positive" },
  READY_FOR_COLLECTION_DELIVERY: { headline: "Ready for collection or delivery",     intro: "Your shipment is ready — we'll arrange delivery, or you can collect it.",                       accent: "#16a34a", tone: "positive" },
  OUT_FOR_DELIVERY:              { headline: "Out for delivery",                     intro: "Your shipment is on its way to you today — it's nearly there.",                                 accent: "#ea580c", tone: "positive" },
  DELIVERED_COLLECTED:           { headline: "Delivered — thank you",                intro: "Your shipment has been delivered/collected. We really appreciate your business and look forward to helping again.", accent: "#16a34a", tone: "positive" },
  CANCELLED:                     { headline: "Your shipment has been cancelled",     intro: "This shipment has been cancelled. Please get in touch if you have any questions.",              accent: "#dc2626", tone: "negative" },
  // ─── Legacy codes (kept so existing orders still email correctly) ───
  PENDING_TRACKING_NUMBER:       { headline: "We're getting your shipment ready",    intro: "We're arranging collection of your cargo and will share tracking as soon as it's on the move.",  accent: "#d97706", tone: "neutral" },
  RECEIVED_FROM_SUPPLIER:        { headline: "Your cargo is with us",                intro: "We've received your goods and they're being prepared for the journey ahead.",                   accent: "#7c3aed", tone: "neutral" },
  EXPORT_CUSTOMS_CLEARED:        { headline: "Cleared for export",                   intro: "Your shipment has cleared customs at the origin and is ready to travel.",                       accent: "#0ea5e9", tone: "positive" },
  LOADED_ONTO_VESSEL:            { headline: "Loaded and ready to sail",             intro: "Your cargo is safely aboard, and the vessel is preparing to depart.",                           accent: "#2563eb", tone: "positive" },
  VESSEL_DEPARTED:               { headline: "Your shipment has set sail",           intro: "The vessel has left the origin port and is on its way to you.",                                 accent: "#2563eb", tone: "positive" },
  MID_OCEAN_TRANSIT:             { headline: "On the water and making progress",     intro: "Your shipment is crossing the ocean, steadily making its way to you.",                          accent: "#2563eb", tone: "positive" },
  APPROACHING_DESTINATION_PORT:  { headline: "Almost at the destination port",       intro: "The vessel is nearing the destination port — arrival is close.",                                accent: "#2563eb", tone: "positive" },
  VESSEL_ARRIVED:                { headline: "Arrived at the destination port",      intro: "Your shipment has reached port and will begin customs clearance shortly.",                      accent: "#16a34a", tone: "positive" },
  IMPORT_CUSTOMS_CLEARANCE:      { headline: "Clearing customs at the destination",  intro: "Your shipment is being cleared by customs and will be released for delivery soon.",             accent: "#d97706", tone: "neutral" },
  DELIVERED:                     { headline: "Delivered — thank you",                intro: "Your shipment has arrived safely. We really appreciate your business and look forward to helping again.", accent: "#16a34a", tone: "positive" },
};

// Also index the copy by friendly label ("Vessel Departed") so callers that
// already converted a code to its label still resolve the same copy.
for (const [code, label] of Object.entries(LOGISTICS_STATUS_LABELS)) {
  if (!(label in LOGISTICS_STATUS_COPY) && LOGISTICS_STATUS_COPY[code]) {
    LOGISTICS_STATUS_COPY[label] = LOGISTICS_STATUS_COPY[code];
  }
}
