// Framework-agnostic order status data (statuses, transitions, customer copy,
// suggested admin messages) lives in @workspace/order-statuses so the admin
// UI and the server email template stay in lockstep.
//
// This file layers on the UI-only bits (lucide icons, tailwind classes) that
// don't belong in a shared lib.
import {
  ClipboardList, Settings2, Truck, AlertTriangle,
  Navigation, House, PackageX, Ban, Package, FilePlus2,
} from "lucide-react";

export {
  ORDER_STATUSES,
  type OrderStatus,
  type StatusChoices,
  statusChoices,
  nextStatuses,
  isTerminal,
  STATUS_COPY,
  statusCopy,
  type StatusCopy,
  SUGGESTED_MESSAGES,
  suggestedMessages,
  // Transport-aware logistics flows (AIR / SEA)
  TRANSPORT_MODES,
  type TransportMode,
  TRANSPORT_MODE_LABELS,
  LOGISTICS_STATUS_FLOWS,
  LOGISTICS_STATUS_LABELS,
  isLogisticsStatus,
  logisticsStatusLabel,
  logisticsFlow,
  isStatusValidForMode,
  isLogisticsTerminal,
  nextLogisticsStatus,
  remainingLogisticsStatuses,
} from "@workspace/order-statuses";

import { logisticsStatusLabel as logiLabel, isLogisticsStatus as isLogiStatus } from "@workspace/order-statuses";
import { Ship, Plane, Anchor, Waves, ShieldCheck, Container } from "lucide-react";

// ─── Visual config (shared between detail page + lists) ──────────────────────
export interface StatusVisual {
  icon: React.ElementType;
  bg: string;
  border: string;
  iconColor: string;
  label: string;
}

export const STATUS_VISUALS: Record<string, StatusVisual> = {
  "Created":          { icon: FilePlus2,     bg: "bg-slate-50",  border: "border-slate-300",  iconColor: "text-slate-500",  label: "Created" },
  "Order received":   { icon: ClipboardList, bg: "bg-sky-50",    border: "border-sky-300",    iconColor: "text-sky-600",    label: "Order Received" },
  "Processing":       { icon: Settings2,     bg: "bg-violet-50", border: "border-violet-300", iconColor: "text-violet-600", label: "Processing" },
  "In transit":       { icon: Truck,         bg: "bg-blue-50",   border: "border-blue-300",   iconColor: "text-blue-600",   label: "In Transit" },
  "Delayed":          { icon: AlertTriangle, bg: "bg-amber-50",  border: "border-amber-300",  iconColor: "text-amber-600",  label: "Delayed" },
  "Out for delivery": { icon: Navigation,    bg: "bg-orange-50", border: "border-orange-300", iconColor: "text-orange-600", label: "Out for Delivery" },
  "Delivered":        { icon: House,         bg: "bg-green-50",  border: "border-green-400",  iconColor: "text-green-600",  label: "Delivered" },
  "Failed delivery":  { icon: PackageX,      bg: "bg-red-50",    border: "border-red-300",    iconColor: "text-red-600",    label: "Failed Delivery" },
  "Cancelled":        { icon: Ban,           bg: "bg-gray-100",  border: "border-gray-300",   iconColor: "text-gray-500",   label: "Cancelled" },
};

// Visuals for the transport-aware logistics status codes. Labels come from
// the shared lib so admin UI, emails, and the public page always agree.
const LOGISTICS_STATUS_VISUALS: Record<string, Omit<StatusVisual, "label">> = {
  ORDER_CONFIRMED:              { icon: ClipboardList, bg: "bg-sky-50",    border: "border-sky-300",    iconColor: "text-sky-600" },
  PENDING_TRACKING_NUMBER:      { icon: Package,       bg: "bg-amber-50",  border: "border-amber-300",  iconColor: "text-amber-600" },
  RECEIVED_FROM_SUPPLIER:       { icon: Package,       bg: "bg-violet-50", border: "border-violet-300", iconColor: "text-violet-600" },
  EXPORT_CUSTOMS_CLEARED:       { icon: ShieldCheck,   bg: "bg-teal-50",   border: "border-teal-300",   iconColor: "text-teal-600" },
  LOADED_ONTO_VESSEL:           { icon: Container,     bg: "bg-blue-50",   border: "border-blue-300",   iconColor: "text-blue-600" },
  VESSEL_DEPARTED:              { icon: Ship,          bg: "bg-blue-50",   border: "border-blue-300",   iconColor: "text-blue-600" },
  MID_OCEAN_TRANSIT:            { icon: Waves,         bg: "bg-blue-50",   border: "border-blue-300",   iconColor: "text-blue-600" },
  APPROACHING_DESTINATION_PORT: { icon: Navigation,    bg: "bg-indigo-50", border: "border-indigo-300", iconColor: "text-indigo-600" },
  VESSEL_ARRIVED:               { icon: Anchor,        bg: "bg-cyan-50",   border: "border-cyan-300",   iconColor: "text-cyan-600" },
  IN_TRANSIT:                   { icon: Plane,         bg: "bg-blue-50",   border: "border-blue-300",   iconColor: "text-blue-600" },
  IMPORT_CUSTOMS_CLEARANCE:     { icon: ShieldCheck,   bg: "bg-amber-50",  border: "border-amber-300",  iconColor: "text-amber-600" },
  OUT_FOR_DELIVERY:             { icon: Truck,         bg: "bg-orange-50", border: "border-orange-300", iconColor: "text-orange-600" },
  DELIVERED:                    { icon: House,         bg: "bg-green-50",  border: "border-green-400",  iconColor: "text-green-600" },
};

export function getStatusVisual(status: string): StatusVisual {
  if (STATUS_VISUALS[status]) return STATUS_VISUALS[status];
  if (isLogiStatus(status)) {
    const base = LOGISTICS_STATUS_VISUALS[status];
    return { ...base, label: logiLabel(status) };
  }
  return {
    icon: Package,
    bg: "bg-muted",
    border: "border-border",
    iconColor: "text-muted-foreground",
    label: status,
  };
}
