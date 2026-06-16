import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  BusinessTypeSelector,
  BUSINESS_TYPES,
} from "@/components/business-type-selector";

// Lucide icons are SVG-based; jsdom handles them but they don't affect logic.
// Silence any SVG-related console noise.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("BUSINESS_TYPES constant", () => {
  it("exports exactly 8 business types", () => {
    expect(BUSINESS_TYPES).toHaveLength(8);
  });

  it("every entry has a non-empty value, label and description", () => {
    for (const bt of BUSINESS_TYPES) {
      expect(bt.value.length).toBeGreaterThan(0);
      expect(bt.label.length).toBeGreaterThan(0);
      expect(bt.description.length).toBeGreaterThan(0);
    }
  });

  it("all values are unique", () => {
    const values = BUSINESS_TYPES.map((bt) => bt.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("includes the 8 expected types", () => {
    const labels = BUSINESS_TYPES.map((bt) => bt.label);
    expect(labels).toContain("Logistics Company");
    expect(labels).toContain("Restaurant");
    expect(labels).toContain("Retail Store");
    expect(labels).toContain("Pharmacy");
    expect(labels).toContain("Dry Cleaner");
    expect(labels).toContain("Repair Shop");
    expect(labels).toContain("Printing Shop");
    expect(labels).toContain("Custom Business");
  });
});

describe("BusinessTypeSelector", () => {
  const setup = (props: Partial<Parameters<typeof BusinessTypeSelector>[0]> = {}) => {
    const onChange = vi.fn();
    render(
      <BusinessTypeSelector
        value={props.value ?? null}
        onChange={props.onChange ?? onChange}
        compact={props.compact}
      />,
    );
    return { onChange };
  };

  it("renders the search input", () => {
    setup();
    expect(screen.getByLabelText("Search business types")).toBeInTheDocument();
  });

  it("renders all 8 business type cards", () => {
    setup();
    for (const bt of BUSINESS_TYPES) {
      expect(screen.getByText(bt.label)).toBeInTheDocument();
    }
  });

  it("renders descriptions in default (non-compact) mode", () => {
    setup();
    for (const bt of BUSINESS_TYPES) {
      expect(screen.getByText(bt.description)).toBeInTheDocument();
    }
  });

  it("hides descriptions in compact mode", () => {
    setup({ compact: true });
    for (const bt of BUSINESS_TYPES) {
      expect(screen.queryByText(bt.description)).not.toBeInTheDocument();
    }
  });

  it("shows no selection check when value is null", () => {
    setup({ value: null });
    // All cards should have aria-selected="false"
    const allOptions = screen.getAllByRole("option");
    expect(allOptions.every((o) => o.getAttribute("aria-selected") === "false")).toBe(true);
  });

  it("marks the matching card as selected when a value is provided", () => {
    setup({ value: "Restaurant" });
    const option = screen.getByRole("option", { name: /Restaurant/i });
    expect(option).toHaveAttribute("aria-selected", "true");
  });

  it("calls onChange with the correct value when a card is clicked", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByRole("option", { name: /Pharmacy/i }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("Pharmacy");
  });

  it("does not call onChange when the already-selected card is clicked", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: "Pharmacy" });
    await user.click(screen.getByRole("option", { name: /Pharmacy/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("filters cards when search query matches a label", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText("Search business types"), "restau");
    expect(screen.getByText("Restaurant")).toBeInTheDocument();
    expect(screen.queryByText("Pharmacy")).not.toBeInTheDocument();
  });

  it("filters cards when search query matches a description", async () => {
    const user = userEvent.setup();
    setup();
    // "courier" appears in Logistics Company's description
    await user.type(screen.getByLabelText("Search business types"), "courier");
    expect(screen.getByText("Logistics Company")).toBeInTheDocument();
    expect(screen.queryByText("Restaurant")).not.toBeInTheDocument();
  });

  it("search is case-insensitive", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText("Search business types"), "PHARMACY");
    expect(screen.getByText("Pharmacy")).toBeInTheDocument();
  });

  it("shows no cards when search finds no matches", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(
      screen.getByLabelText("Search business types"),
      "xyznosuchtype",
    );
    for (const bt of BUSINESS_TYPES) {
      expect(screen.queryByText(bt.label)).not.toBeInTheDocument();
    }
  });

  it("shows the clear (X) button only when there is a query", async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Search business types"), "a");
    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();
  });

  it("clears the query when the X button is clicked, restoring all cards", async () => {
    const user = userEvent.setup();
    setup();
    const input = screen.getByLabelText("Search business types");
    await user.type(input, "restau");
    // Only Restaurant visible
    expect(screen.queryByText("Pharmacy")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Clear search"));
    // All cards restored
    for (const bt of BUSINESS_TYPES) {
      expect(screen.getByText(bt.label)).toBeInTheDocument();
    }
    expect(input).toHaveValue("");
  });
});
