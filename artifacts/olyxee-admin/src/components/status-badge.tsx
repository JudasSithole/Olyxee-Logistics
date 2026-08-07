import { Badge } from "@/components/ui/badge";
import { isLogisticsStatus, logisticsStatusLabel } from "@/lib/order-statuses";

// Colours for transport-aware logistics status codes.
const LOGISTICS_STATUS_COLORS: Record<string, string> = {
  ORDER_CONFIRMED: "bg-gray-100 text-gray-700 border-gray-200",
  RECEIVED_FROM_SUPPLIER: "bg-violet-100 text-violet-800 border-violet-200",
  EXPORT_CUSTOMS_CLEARED: "bg-teal-100 text-teal-800 border-teal-200",
  LOADED_ONTO_VESSEL: "bg-blue-100 text-blue-800 border-blue-200",
  VESSEL_DEPARTED: "bg-blue-100 text-blue-800 border-blue-200",
  MID_OCEAN_TRANSIT: "bg-indigo-100 text-indigo-800 border-indigo-200",
  APPROACHING_DESTINATION_PORT: "bg-indigo-100 text-indigo-800 border-indigo-200",
  VESSEL_ARRIVED: "bg-cyan-100 text-cyan-800 border-cyan-200",
  IN_TRANSIT: "bg-indigo-100 text-indigo-800 border-indigo-200",
  IMPORT_CUSTOMS_CLEARANCE: "bg-amber-100 text-amber-800 border-amber-200",
  OUT_FOR_DELIVERY: "bg-violet-100 text-violet-800 border-violet-200",
  DELIVERED: "bg-green-100 text-green-800 border-green-200",
};

const STATUS_COLORS: Record<string, string> = {
  "Order received": "bg-gray-100 text-gray-700 border-gray-200",
  "Processing": "bg-blue-50 text-blue-700 border-blue-200",
  "In transit": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Out for delivery": "bg-violet-100 text-violet-800 border-violet-200",
  "Delivered": "bg-green-100 text-green-800 border-green-200",
  "Delayed": "bg-amber-100 text-amber-800 border-amber-200",
  "Failed delivery": "bg-red-100 text-red-800 border-red-200",
  "Cancelled": "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const colorClass =
    STATUS_COLORS[status] ||
    LOGISTICS_STATUS_COLORS[status] ||
    "bg-gray-100 text-gray-800 border-gray-200";
  const label = isLogisticsStatus(status) ? logisticsStatusLabel(status) : status;
  return (
    <Badge variant="outline" className={`font-medium ${colorClass} ${className}`}>
      {label}
    </Badge>
  );
}
