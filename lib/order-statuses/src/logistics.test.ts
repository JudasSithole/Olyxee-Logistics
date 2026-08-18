import { describe, it, expect } from "vitest";
import {
  TRANSPORT_MODES,
  LOGISTICS_STATUS_FLOWS,
  LOGISTICS_STATUS_LABELS,
  LEGACY_STATUS_MAP,
  CANCELLED_STATUS,
  isTransportMode,
  isLogisticsStatus,
  logisticsStatusLabel,
  logisticsFlow,
  normalizeLogisticsStatus,
  isStatusValidForMode,
  isLogisticsTerminal,
  nextLogisticsStatus,
  remainingLogisticsStatuses,
  statusCopy,
} from "./index";

describe("transport modes", () => {
  it("supports AIR and SEA", () => {
    expect(TRANSPORT_MODES).toEqual(["AIR", "SEA"]);
    expect(isTransportMode("AIR")).toBe(true);
    expect(isTransportMode("SEA")).toBe(true);
    expect(isTransportMode("ROAD")).toBe(false);
    expect(isTransportMode(null)).toBe(false);
  });
});

describe("shipment flows (physical movement only — no billing/payment)", () => {
  it("AIR flow is the collection → delivery sequence", () => {
    expect(LOGISTICS_STATUS_FLOWS.AIR).toEqual([
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
      "READY_FOR_COLLECTION_DELIVERY",
      "OUT_FOR_DELIVERY",
      "DELIVERED_COLLECTED",
    ]);
    // AIR never uses sea/vessel stages.
    for (const s of ["LOADING", "DEPARTED_IN_TRANSIT"]) {
      expect(LOGISTICS_STATUS_FLOWS.AIR).not.toContain(s);
    }
  });

  it("SEA flow adds Loading + Departed/In Transit in place of the AIR leg", () => {
    expect(LOGISTICS_STATUS_FLOWS.SEA).toEqual([
      "ORDER_CONFIRMED",
      "COLLECTED_FROM_SUPPLIER",
      "RECEIVED_AT_WAREHOUSE",
      "PREPARING_FOR_SHIPMENT",
      "LOADING",
      "DEPARTED_IN_TRANSIT",
      "ARRIVED_AT_DESTINATION",
      "AWAITING_VAT_DUTY_PAYMENT",
      "VAT_DUTY_PAID",
      "UNDERGOING_CUSTOMS_CLEARANCE",
      "CUSTOMS_CLEARANCE_COMPLETED",
      "READY_FOR_COLLECTION_DELIVERY",
      "OUT_FOR_DELIVERY",
      "DELIVERED_COLLECTED",
    ]);
    expect(LOGISTICS_STATUS_FLOWS.SEA).not.toContain("IN_TRANSIT");
  });

  it("CANCELLED is a terminal exception, never in the linear flow", () => {
    expect(LOGISTICS_STATUS_FLOWS.AIR).not.toContain("CANCELLED");
    expect(LOGISTICS_STATUS_FLOWS.SEA).not.toContain("CANCELLED");
    expect(isStatusValidForMode("AIR", "CANCELLED")).toBe(true);
    expect(isLogisticsTerminal("CANCELLED")).toBe(true);
    // It must never be suggested as the automatic next status.
    for (const mode of TRANSPORT_MODES) {
      for (const s of LOGISTICS_STATUS_FLOWS[mode]) {
        expect(nextLogisticsStatus(mode, s)).not.toBe("CANCELLED");
      }
    }
  });

  it("logisticsFlow returns null for unknown modes", () => {
    expect(logisticsFlow("ROAD")).toBeNull();
    expect(logisticsFlow("")).toBeNull();
  });
});

describe("next status + terminal", () => {
  it("suggests the next stage in order", () => {
    expect(nextLogisticsStatus("AIR", "ORDER_CONFIRMED")).toBe("COLLECTED_FROM_SUPPLIER");
    expect(nextLogisticsStatus("AIR", "ARRIVED_AT_DESTINATION")).toBe("AWAITING_VAT_DUTY_PAYMENT");
    expect(nextLogisticsStatus("SEA", "LOADING")).toBe("DEPARTED_IN_TRANSIT");
    expect(nextLogisticsStatus("SEA", "VAT_DUTY_PAID")).toBe("UNDERGOING_CUSTOMS_CLEARANCE");
  });

  it("DELIVERED_COLLECTED is terminal", () => {
    expect(isLogisticsTerminal("DELIVERED_COLLECTED")).toBe(true);
    expect(nextLogisticsStatus("AIR", "DELIVERED_COLLECTED")).toBeNull();
    expect(isLogisticsTerminal("OUT_FOR_DELIVERY")).toBe(false);
    expect(isLogisticsTerminal("ORDER_CONFIRMED")).toBe(false);
  });

  it("remainingLogisticsStatuses returns later stages only", () => {
    expect(remainingLogisticsStatuses("AIR", "READY_FOR_COLLECTION_DELIVERY")).toEqual([
      "OUT_FOR_DELIVERY",
      "DELIVERED_COLLECTED",
    ]);
    expect(remainingLogisticsStatuses("AIR", "DELIVERED_COLLECTED")).toEqual([]);
  });
});

describe("legacy status compatibility", () => {
  it("maps retired codes to their closest current stage (forward, never back)", () => {
    expect(normalizeLogisticsStatus("RECEIVED_FROM_SUPPLIER")).toBe("RECEIVED_AT_WAREHOUSE");
    expect(normalizeLogisticsStatus("VESSEL_DEPARTED")).toBe("DEPARTED_IN_TRANSIT");
    expect(normalizeLogisticsStatus("DELIVERED")).toBe("DELIVERED_COLLECTED");
    // A current code is returned unchanged.
    expect(normalizeLogisticsStatus("IN_TRANSIT")).toBe("IN_TRANSIT");
  });

  it("advances an existing (legacy) shipment forward from its mapped position", () => {
    // VESSEL_ARRIVED -> ARRIVED_AT_DESTINATION -> next is AWAITING_VAT_DUTY_PAYMENT.
    expect(nextLogisticsStatus("SEA", "VESSEL_ARRIVED")).toBe("AWAITING_VAT_DUTY_PAYMENT");
    // Never dumps the whole flow (which could move a shipment backwards).
    expect(remainingLogisticsStatuses("SEA", "VESSEL_ARRIVED")).not.toContain("COLLECTED_FROM_SUPPLIER");
  });

  it("legacy codes still render friendly labels", () => {
    expect(logisticsStatusLabel("VESSEL_DEPARTED")).toBe("Vessel Departed");
    expect(isLogisticsStatus("RECEIVED_FROM_SUPPLIER")).toBe(true);
  });
});

describe("shipment vs billing independence", () => {
  it("VAT/duty shipment stages are NOT billing statuses", () => {
    // AWAITING_VAT_DUTY_PAYMENT / VAT_DUTY_PAID describe customs charges on the
    // cargo and live in the shipment flow. They must not overlap the freight
    // billing_status values (NOT_INVOICED/INVOICED/AWAITING_PAYMENT/PAID).
    const billingStatuses = ["NOT_INVOICED", "INVOICED", "AWAITING_PAYMENT", "PAID"];
    for (const mode of TRANSPORT_MODES) {
      for (const s of LOGISTICS_STATUS_FLOWS[mode]) {
        expect(billingStatuses).not.toContain(s);
      }
    }
    expect(LOGISTICS_STATUS_FLOWS.AIR).toContain("VAT_DUTY_PAID");
    // The freight "PAID" billing state is never a shipment status.
    expect(LOGISTICS_STATUS_FLOWS.AIR).not.toContain("PAID");
    expect(LOGISTICS_STATUS_FLOWS.SEA).not.toContain("PAID");
  });
});

describe("labels + email copy", () => {
  it("every flow status has a friendly, underscore-free label", () => {
    for (const mode of TRANSPORT_MODES) {
      for (const s of LOGISTICS_STATUS_FLOWS[mode]) {
        expect(isLogisticsStatus(s)).toBe(true);
        const label = logisticsStatusLabel(s);
        expect(label).toBeTruthy();
        expect(label).not.toContain("_");
      }
    }
    expect(logisticsStatusLabel(CANCELLED_STATUS)).toBe("Cancelled");
  });

  it("statusCopy resolves current + legacy codes to friendly copy", () => {
    const c = statusCopy("AWAITING_VAT_DUTY_PAYMENT");
    expect(c.headline).not.toContain("_");
    const legacy = statusCopy("VESSEL_DEPARTED");
    expect(legacy.headline).not.toContain("VESSEL_DEPARTED");
    expect(statusCopy(LOGISTICS_STATUS_LABELS.VESSEL_DEPARTED)).toEqual(legacy);
  });

  it("keeps a legacy map entry for every retired code that isn't in the new flow", () => {
    for (const [legacy, mapped] of Object.entries(LEGACY_STATUS_MAP)) {
      expect(LOGISTICS_STATUS_LABELS[legacy]).toBeTruthy();
      expect([...LOGISTICS_STATUS_FLOWS.AIR, ...LOGISTICS_STATUS_FLOWS.SEA]).toContain(mapped);
    }
  });
});
