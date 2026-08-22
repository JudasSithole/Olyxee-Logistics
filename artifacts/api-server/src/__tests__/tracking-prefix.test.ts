import { describe, expect, it } from "vitest";
import { companyAcronym, generateTrackingId, resolveTrackingPrefix } from "../lib/id";

describe("tenant tracking prefixes", () => {
  it("derives a multi-word company acronym", () => {
    expect(companyAcronym("Freight Solutions Logistics (Pty) Ltd")).toBe("FSL");
  });

  it("replaces the legacy TRK default with the current company acronym", () => {
    expect(resolveTrackingPrefix("TRK", "Freight Solutions Logistics", "freight-solutions-logistics")).toBe("FSL");
    expect(generateTrackingId(resolveTrackingPrefix("TRK", "Freight Solutions Logistics"))).toMatch(/^FSL-[A-Z2-9]{3}-[A-Z2-9]{4}$/);
  });

  it("preserves a prefix deliberately configured by the tenant", () => {
    expect(resolveTrackingPrefix("FAST", "Freight Solutions Logistics")).toBe("FAST");
  });
});
