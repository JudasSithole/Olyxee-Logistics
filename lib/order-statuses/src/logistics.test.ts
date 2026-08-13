import { describe, it, expect } from "vitest";
import {
  TRANSPORT_MODES,
  LOGISTICS_STATUS_FLOWS,
  LOGISTICS_STATUS_LABELS,
  isTransportMode,
  isLogisticsStatus,
  logisticsStatusLabel,
  logisticsFlow,
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

describe("flows", () => {
  it("SEA flow has 11 stages including vessel stages, in order", () => {
    expect(LOGISTICS_STATUS_FLOWS.SEA).toEqual([
      "ORDER_CONFIRMED",
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
    ]);
  });

  it("AIR flow has 7 stages with generic IN_TRANSIT and no vessel stages", () => {
    expect(LOGISTICS_STATUS_FLOWS.AIR).toEqual([
      "ORDER_CONFIRMED",
      "RECEIVED_FROM_SUPPLIER",
      "EXPORT_CUSTOMS_CLEARED",
      "IN_TRANSIT",
      "IMPORT_CUSTOMS_CLEARANCE",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
    ]);
    const vesselStages = [
      "LOADED_ONTO_VESSEL",
      "VESSEL_DEPARTED",
      "MID_OCEAN_TRANSIT",
      "APPROACHING_DESTINATION_PORT",
      "VESSEL_ARRIVED",
    ];
    for (const s of LOGISTICS_STATUS_FLOWS.AIR) {
      expect(vesselStages).not.toContain(s);
    }
  });

  it("logisticsFlow returns null for unknown modes", () => {
    expect(logisticsFlow("ROAD")).toBeNull();
    expect(logisticsFlow("")).toBeNull();
  });
});

describe("mode validation", () => {
  it("accepts statuses belonging to the mode's flow", () => {
    expect(isStatusValidForMode("SEA", "VESSEL_DEPARTED")).toBe(true);
    expect(isStatusValidForMode("AIR", "IN_TRANSIT")).toBe(true);
  });

  it("rejects vessel stages for AIR and IN_TRANSIT for SEA", () => {
    expect(isStatusValidForMode("AIR", "VESSEL_DEPARTED")).toBe(false);
    expect(isStatusValidForMode("AIR", "LOADED_ONTO_VESSEL")).toBe(false);
    expect(isStatusValidForMode("SEA", "IN_TRANSIT")).toBe(false);
  });

  it("rejects everything for unknown modes", () => {
    expect(isStatusValidForMode("ROAD", "DELIVERED")).toBe(false);
  });
});

describe("next status + terminal", () => {
  it("suggests the next stage in order", () => {
    expect(nextLogisticsStatus("SEA", "ORDER_CONFIRMED")).toBe("RECEIVED_FROM_SUPPLIER");
    expect(nextLogisticsStatus("SEA", "VESSEL_ARRIVED")).toBe("IMPORT_CUSTOMS_CLEARANCE");
    expect(nextLogisticsStatus("AIR", "EXPORT_CUSTOMS_CLEARED")).toBe("IN_TRANSIT");
  });

  it("DELIVERED is terminal with no next status", () => {
    expect(isLogisticsTerminal("DELIVERED")).toBe(true);
    expect(nextLogisticsStatus("SEA", "DELIVERED")).toBeNull();
    expect(nextLogisticsStatus("AIR", "DELIVERED")).toBeNull();
  });

  it("non-terminal statuses are not terminal", () => {
    expect(isLogisticsTerminal("OUT_FOR_DELIVERY")).toBe(false);
    expect(isLogisticsTerminal("ORDER_CONFIRMED")).toBe(false);
  });

  it("remainingLogisticsStatuses returns later stages only", () => {
    expect(remainingLogisticsStatuses("AIR", "IN_TRANSIT")).toEqual([
      "IMPORT_CUSTOMS_CLEARANCE",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
    ]);
    expect(remainingLogisticsStatuses("AIR", "DELIVERED")).toEqual([]);
  });
});

describe("labels + email copy", () => {
  it("every flow status has a friendly label", () => {
    for (const mode of TRANSPORT_MODES) {
      for (const s of LOGISTICS_STATUS_FLOWS[mode]) {
        expect(isLogisticsStatus(s)).toBe(true);
        const label = logisticsStatusLabel(s);
        expect(label).toBeTruthy();
        expect(label).not.toContain("_");
      }
    }
  });

  it("unknown statuses pass through logisticsStatusLabel unchanged", () => {
    expect(logisticsStatusLabel("Delivered")).toBe("Delivered");
  });

  it("statusCopy resolves logistics codes and their labels to friendly copy", () => {
    const byCode = statusCopy("VESSEL_DEPARTED");
    expect(byCode.headline).not.toContain("VESSEL_DEPARTED");
    const byLabel = statusCopy(LOGISTICS_STATUS_LABELS.VESSEL_DEPARTED);
    expect(byLabel).toEqual(byCode);
  });
});
