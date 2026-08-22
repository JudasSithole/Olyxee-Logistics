export const SHIPMENT_EXCEPTION_TYPES = [
  "Customs — Document Review",
  "Customs — Scanner Inspection",
  "Customs — Physical Inspection",
  "Weather Delay",
  "Documentation Issue",
  "Carrier Delay",
  "Port / Airport Congestion",
  "Customer Action Required",
  "Other",
] as const;

export type ShipmentExceptionType = (typeof SHIPMENT_EXCEPTION_TYPES)[number];

export const SHIPMENT_EXCEPTION_EXPLANATIONS: Record<ShipmentExceptionType, string> = {
  "Customs — Document Review": "Customs is reviewing the shipment documentation before release.",
  "Customs — Scanner Inspection": "The shipment has been selected for a customs scanner inspection.",
  "Customs — Physical Inspection": "The shipment has been selected for a physical customs inspection. Release will continue once the inspection is completed.",
  "Weather Delay": "Weather conditions are affecting the movement of this shipment and may affect the expected delivery time.",
  "Documentation Issue": "Additional or corrected documentation is required before the shipment can continue.",
  "Carrier Delay": "The carrier has reported a delay that may affect the expected delivery time.",
  "Port / Airport Congestion": "Congestion at the port or airport is affecting the movement of this shipment.",
  "Customer Action Required": "Action is required from the customer before this shipment can continue.",
  "Other": "An issue is affecting this shipment. We will share another update as soon as more information is available.",
};

export function shipmentExceptionExplanation(type: ShipmentExceptionType): string {
  return SHIPMENT_EXCEPTION_EXPLANATIONS[type];
}

export function shipmentExceptionLabel(type: string): string {
  return type.replace(/^Customs\s+—\s+/, "");
}
