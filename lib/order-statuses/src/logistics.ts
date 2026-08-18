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

// Internal status codes per mode, in strict shipment order.
export const LOGISTICS_STATUS_FLOWS: Record<TransportMode, readonly string[]> = {
  AIR: [
    "ORDER_CONFIRMED",
    "PENDING_TRACKING_NUMBER",
    "RECEIVED_FROM_SUPPLIER",
    "EXPORT_CUSTOMS_CLEARED",
    "IN_TRANSIT",
    "IMPORT_CUSTOMS_CLEARANCE",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ],
  SEA: [
    "ORDER_CONFIRMED",
    "PENDING_TRACKING_NUMBER",
    "RECEIVED_FROM_SUPPLIER",
    "EXPORT_CUSTOMS_CLEARED",
    "LOADED_ONTO_VESSEL",
    "VESSEL_DEPARTED",
    "MID_OCEAN_TRANSIT",
    "APPROACHING_DESTINATION_PORT",
    "VESSEL_ARRIVED",
    "IMPORT_CUSTOMS_CLEARANCE",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ],
};

// Customer-facing labels for every logistics status code.
export const LOGISTICS_STATUS_LABELS: Record<string, string> = {
  ORDER_CONFIRMED: "Job Confirmed",
  PENDING_TRACKING_NUMBER: "Pending Tracking Number",
  RECEIVED_FROM_SUPPLIER: "Received from Supplier",
  EXPORT_CUSTOMS_CLEARED: "Export Customs Cleared",
  LOADED_ONTO_VESSEL: "Loaded onto Vessel",
  VESSEL_DEPARTED: "Vessel Departed",
  MID_OCEAN_TRANSIT: "Mid-Ocean Transit",
  APPROACHING_DESTINATION_PORT: "Approaching Destination Port",
  VESSEL_ARRIVED: "Vessel Arrived",
  IN_TRANSIT: "In Transit",
  IMPORT_CUSTOMS_CLEARANCE: "Import Customs Clearance",
  OUT_FOR_DELIVERY: "Out for Delivery",
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

/** Is `status` a valid status for orders shipped via `mode`? */
export function isStatusValidForMode(mode: string, status: string): boolean {
  const flow = logisticsFlow(mode);
  return !!flow && flow.includes(status);
}

/** Terminal check for logistics flows: DELIVERED ends the shipment. */
export function isLogisticsTerminal(status: string): boolean {
  return status === "DELIVERED";
}

/**
 * The next suggested status for an order in `mode` currently at `current`.
 * Returns null when current is terminal, unknown, or the mode is invalid.
 */
export function nextLogisticsStatus(mode: string, current: string): string | null {
  const flow = logisticsFlow(mode);
  if (!flow) return null;
  const idx = flow.indexOf(current);
  if (idx === -1 || idx >= flow.length - 1) return null;
  return flow[idx + 1];
}

/**
 * Remaining statuses after `current` in the mode's flow (excluding current).
 * Used by the admin picker so operators only ever see mode-valid statuses.
 */
export function remainingLogisticsStatuses(mode: string, current: string): string[] {
  const flow = logisticsFlow(mode);
  if (!flow) return [];
  const idx = flow.indexOf(current);
  if (idx === -1) return [...flow];
  return flow.slice(idx + 1) as string[];
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
  ORDER_CONFIRMED:              { headline: "Your order is confirmed",              intro: "We've confirmed your order and will start preparing the shipment.",           accent: "#0284c7", tone: "neutral" },
  PENDING_TRACKING_NUMBER:      { headline: "Pending tracking number",              intro: "Payment is confirmed. We're waiting for the China warehouse to receive your cargo and assign its shipment tracking number.", accent: "#d97706", tone: "neutral" },
  RECEIVED_FROM_SUPPLIER:       { headline: "We've received your goods",            intro: "Your shipment has been received from the supplier and is being prepared.",   accent: "#7c3aed", tone: "neutral" },
  EXPORT_CUSTOMS_CLEARED:       { headline: "Export customs cleared",               intro: "Your shipment has cleared customs at the origin and is ready to travel.",    accent: "#0ea5e9", tone: "positive" },
  LOADED_ONTO_VESSEL:           { headline: "Loaded onto the vessel",               intro: "Your shipment is aboard and the vessel is preparing to depart.",             accent: "#2563eb", tone: "positive" },
  VESSEL_DEPARTED:              { headline: "Your shipment has set sail",           intro: "The vessel has departed the origin port and is on its way.",                 accent: "#2563eb", tone: "positive" },
  MID_OCEAN_TRANSIT:            { headline: "Crossing the ocean",                   intro: "Your shipment is in mid-ocean transit, steadily making progress.",           accent: "#2563eb", tone: "positive" },
  APPROACHING_DESTINATION_PORT: { headline: "Nearly at the destination port",       intro: "The vessel is approaching the destination port.",                            accent: "#2563eb", tone: "positive" },
  VESSEL_ARRIVED:               { headline: "The vessel has arrived",               intro: "Your shipment has reached the destination port.",                            accent: "#16a34a", tone: "positive" },
  IN_TRANSIT:                   { headline: "Your shipment is in the air",          intro: "It's flying to the destination and will land soon.",                         accent: "#2563eb", tone: "positive" },
  IMPORT_CUSTOMS_CLEARANCE:     { headline: "Going through import customs",         intro: "Your shipment is being cleared by customs at the destination.",              accent: "#d97706", tone: "neutral" },
  OUT_FOR_DELIVERY:             { headline: "Out for delivery",                     intro: "Your shipment is on its way to you now.",                                    accent: "#ea580c", tone: "positive" },
  DELIVERED:                    { headline: "Your shipment has arrived",            intro: "It's been delivered successfully. Thanks for trusting us!",                  accent: "#16a34a", tone: "positive" },
};

// Also index the copy by friendly label ("Vessel Departed") so callers that
// already converted a code to its label still resolve the same copy.
for (const [code, label] of Object.entries(LOGISTICS_STATUS_LABELS)) {
  if (!(label in LOGISTICS_STATUS_COPY) && LOGISTICS_STATUS_COPY[code]) {
    LOGISTICS_STATUS_COPY[label] = LOGISTICS_STATUS_COPY[code];
  }
}
