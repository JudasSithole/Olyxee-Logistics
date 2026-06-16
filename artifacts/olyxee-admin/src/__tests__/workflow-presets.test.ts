import { describe, it, expect } from "vitest";
import {
  WORKFLOW_PRESETS,
  findPreset,
  presetForBusinessType,
  type WorkflowPreset,
} from "@/lib/workflow-presets";

describe("WORKFLOW_PRESETS", () => {
  it("exports exactly 8 presets", () => {
    expect(WORKFLOW_PRESETS).toHaveLength(8);
  });

  it("every preset id starts with 'preset-'", () => {
    for (const p of WORKFLOW_PRESETS) {
      expect(p.id).toMatch(/^preset-/);
    }
  });

  it("all preset ids are unique", () => {
    const ids = WORKFLOW_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every preset has a non-empty name, businessType and description", () => {
    for (const p of WORKFLOW_PRESETS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.businessType.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });

  it("every preset has at least one step", () => {
    for (const p of WORKFLOW_PRESETS) {
      expect(p.steps.length).toBeGreaterThan(0);
    }
  });

  it("every preset has exactly one terminal step", () => {
    for (const p of WORKFLOW_PRESETS) {
      const terminalCount = p.steps.filter((s) => s.isTerminal).length;
      expect(terminalCount).toBe(1);
    }
  });

  it("the terminal step is always the last step in each preset", () => {
    for (const p of WORKFLOW_PRESETS) {
      const last = p.steps[p.steps.length - 1];
      expect(last.isTerminal).toBe(true);
      // Non-last steps must not be terminal
      for (const s of p.steps.slice(0, -1)) {
        expect(s.isTerminal).toBe(false);
      }
    }
  });

  it("step positions are sequential starting from 0", () => {
    for (const p of WORKFLOW_PRESETS) {
      p.steps.forEach((step, idx) => {
        expect(step.position).toBe(idx);
      });
    }
  });

  it("every step has a valid hex color", () => {
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    for (const p of WORKFLOW_PRESETS) {
      for (const s of p.steps) {
        expect(s.color).toMatch(hexPattern);
      }
    }
  });

  it("every step has a non-empty label and description", () => {
    for (const p of WORKFLOW_PRESETS) {
      for (const s of p.steps) {
        expect(s.label.length).toBeGreaterThan(0);
        expect(s.description.length).toBeGreaterThan(0);
      }
    }
  });

  it("includes the 8 expected business types", () => {
    const types = WORKFLOW_PRESETS.map((p) => p.businessType);
    expect(types).toContain("Logistics Company");
    expect(types).toContain("Restaurant");
    expect(types).toContain("Retail Store");
    expect(types).toContain("Pharmacy");
    expect(types).toContain("Dry Cleaner");
    expect(types).toContain("Repair Shop");
    expect(types).toContain("Printing Shop");
    expect(types).toContain("Custom Business");
  });
});

describe("findPreset()", () => {
  it("returns the correct preset for a valid ID", () => {
    const p = findPreset("preset-logistics");
    expect(p).toBeDefined();
    expect(p!.businessType).toBe("Logistics Company");
  });

  it("returns the correct preset for every defined ID", () => {
    for (const preset of WORKFLOW_PRESETS) {
      const found = findPreset(preset.id);
      expect(found).toBe(preset);
    }
  });

  it("returns undefined for an unknown ID", () => {
    expect(findPreset("preset-unknown-xyz")).toBeUndefined();
  });

  it("returns undefined for a DB-style ID (no 'preset-' prefix)", () => {
    expect(findPreset("abc123def456")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(findPreset("")).toBeUndefined();
  });
});

describe("presetForBusinessType()", () => {
  it("returns the matching preset for an exact match", () => {
    const p = presetForBusinessType("Restaurant");
    expect(p).toBeDefined();
    expect(p!.id).toBe("preset-restaurant");
  });

  it("matches case-insensitively", () => {
    expect(presetForBusinessType("RESTAURANT")).toBeDefined();
    expect(presetForBusinessType("restaurant")).toBeDefined();
    expect(presetForBusinessType("ReStAuRaNt")).toBeDefined();
  });

  it("returns a preset for every supported business type", () => {
    const types = [
      "Logistics Company",
      "Restaurant",
      "Retail Store",
      "Pharmacy",
      "Dry Cleaner",
      "Repair Shop",
      "Printing Shop",
      "Custom Business",
    ] as const;
    for (const type of types) {
      expect(presetForBusinessType(type)).toBeDefined();
    }
  });

  it("returns undefined for null", () => {
    expect(presetForBusinessType(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(presetForBusinessType(undefined)).toBeUndefined();
  });

  it("returns undefined for an unrecognised business type", () => {
    expect(presetForBusinessType("Rocket Manufacturer")).toBeUndefined();
  });

  it("returned preset businessType matches the lookup value (case-normalised)", () => {
    const p = presetForBusinessType("dry cleaner");
    expect(p!.businessType.toLowerCase()).toBe("dry cleaner");
  });
});
