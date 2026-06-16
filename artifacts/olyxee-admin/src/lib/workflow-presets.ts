// System workflow presets — defined here on the client so no DB seeding is
// required. These are read-only; users can Clone them to create editable copies.
// IDs use the "preset-" prefix so the engine can distinguish them from DB records.

export interface PresetStep {
  label: string;
  description: string;
  position: number;
  color: string;
  isTerminal: boolean;
}

export interface WorkflowPreset {
  id: string;
  name: string;
  businessType: string;
  description: string;
  steps: PresetStep[];
}

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: "preset-logistics",
    name: "Logistics Company",
    businessType: "Logistics Company",
    description: "Standard last-mile delivery workflow.",
    steps: [
      { label: "Received", description: "Order has been received at the depot", position: 0, color: "#6366f1", isTerminal: false },
      { label: "Dispatched", description: "Order has been dispatched to a driver", position: 1, color: "#8b5cf6", isTerminal: false },
      { label: "Out For Delivery", description: "Driver is en route to the customer", position: 2, color: "#f59e0b", isTerminal: false },
      { label: "Delivered", description: "Order successfully delivered", position: 3, color: "#10b981", isTerminal: true },
    ],
  },
  {
    id: "preset-restaurant",
    name: "Restaurant",
    businessType: "Restaurant",
    description: "Food order to delivery workflow.",
    steps: [
      { label: "Order Received", description: "Order has been received by the kitchen", position: 0, color: "#6366f1", isTerminal: false },
      { label: "Preparing", description: "Kitchen is preparing the order", position: 1, color: "#8b5cf6", isTerminal: false },
      { label: "Ready For Pickup", description: "Order is ready for collection or handover", position: 2, color: "#f59e0b", isTerminal: false },
      { label: "Out For Delivery", description: "Driver is on the way to the customer", position: 3, color: "#ef4444", isTerminal: false },
      { label: "Delivered", description: "Order delivered to the customer", position: 4, color: "#10b981", isTerminal: true },
    ],
  },
  {
    id: "preset-retail",
    name: "Retail Store",
    businessType: "Retail Store",
    description: "Retail order fulfilment workflow.",
    steps: [
      { label: "Order Placed", description: "Customer order has been placed", position: 0, color: "#6366f1", isTerminal: false },
      { label: "Processing", description: "Order is being picked and packed", position: 1, color: "#8b5cf6", isTerminal: false },
      { label: "Dispatched", description: "Order dispatched from the warehouse", position: 2, color: "#f59e0b", isTerminal: false },
      { label: "Out For Delivery", description: "Out for delivery to customer", position: 3, color: "#ef4444", isTerminal: false },
      { label: "Delivered", description: "Order delivered", position: 4, color: "#10b981", isTerminal: true },
    ],
  },
  {
    id: "preset-pharmacy",
    name: "Pharmacy",
    businessType: "Pharmacy",
    description: "Prescription and medication delivery workflow.",
    steps: [
      { label: "Prescription Received", description: "Prescription received and verified", position: 0, color: "#6366f1", isTerminal: false },
      { label: "Dispensing", description: "Medication is being dispensed", position: 1, color: "#8b5cf6", isTerminal: false },
      { label: "Ready For Collection", description: "Medication ready for pickup or delivery", position: 2, color: "#f59e0b", isTerminal: false },
      { label: "Out For Delivery", description: "Driver delivering to patient", position: 3, color: "#ef4444", isTerminal: false },
      { label: "Delivered", description: "Medication delivered", position: 4, color: "#10b981", isTerminal: true },
    ],
  },
  {
    id: "preset-dry-cleaner",
    name: "Dry Cleaner",
    businessType: "Dry Cleaner",
    description: "Garment cleaning and collection workflow.",
    steps: [
      { label: "Received", description: "Garments received at the store", position: 0, color: "#6366f1", isTerminal: false },
      { label: "Cleaning", description: "Garments are being cleaned", position: 1, color: "#8b5cf6", isTerminal: false },
      { label: "Ready For Collection", description: "Garments ready for pickup", position: 2, color: "#f59e0b", isTerminal: false },
      { label: "Collected", description: "Customer has collected their garments", position: 3, color: "#10b981", isTerminal: true },
    ],
  },
  {
    id: "preset-repair",
    name: "Repair Shop",
    businessType: "Repair Shop",
    description: "Device or appliance repair tracking workflow.",
    steps: [
      { label: "Received", description: "Device received and logged", position: 0, color: "#6366f1", isTerminal: false },
      { label: "Under Repair", description: "Technician is working on the device", position: 1, color: "#8b5cf6", isTerminal: false },
      { label: "Ready For Collection", description: "Repair complete — ready for pickup", position: 2, color: "#f59e0b", isTerminal: false },
      { label: "Completed", description: "Device collected by customer", position: 3, color: "#10b981", isTerminal: true },
    ],
  },
  {
    id: "preset-printing",
    name: "Printing Shop",
    businessType: "Printing Shop",
    description: "Print job production and delivery workflow.",
    steps: [
      { label: "Order Received", description: "Print job received and confirmed", position: 0, color: "#6366f1", isTerminal: false },
      { label: "Printing", description: "Job is being printed", position: 1, color: "#8b5cf6", isTerminal: false },
      { label: "Quality Check", description: "Checking print quality", position: 2, color: "#f59e0b", isTerminal: false },
      { label: "Ready For Collection", description: "Print job ready for pickup or delivery", position: 3, color: "#ef4444", isTerminal: false },
      { label: "Delivered", description: "Job delivered or collected", position: 4, color: "#10b981", isTerminal: true },
    ],
  },
  {
    id: "preset-custom",
    name: "Custom Business",
    businessType: "Custom Business",
    description: "Generic workflow — customise the steps to fit your business.",
    steps: [
      { label: "Received", description: "Job received", position: 0, color: "#6366f1", isTerminal: false },
      { label: "In Progress", description: "Work is underway", position: 1, color: "#8b5cf6", isTerminal: false },
      { label: "Ready", description: "Ready for collection or delivery", position: 2, color: "#f59e0b", isTerminal: false },
      { label: "Completed", description: "Job completed", position: 3, color: "#10b981", isTerminal: true },
    ],
  },
];

/** Resolve a preset by ID. Returns undefined when the ID is not a preset. */
export function findPreset(id: string): WorkflowPreset | undefined {
  return WORKFLOW_PRESETS.find((p) => p.id === id);
}

/** Return the best matching preset for a business type, or undefined. */
export function presetForBusinessType(businessType: string | null | undefined): WorkflowPreset | undefined {
  if (!businessType) return undefined;
  return WORKFLOW_PRESETS.find(
    (p) => p.businessType.toLowerCase() === businessType.toLowerCase(),
  );
}
