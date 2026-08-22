import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

import { sendInvoiceEmail, type SendInvoiceEmailParams } from "../lib/email";

const invoice: SendInvoiceEmailParams = {
  customerEmail: "customer@example.com", customerName: "Thabo Nkosi",
  customerAddress: "Johannesburg", customerPhone: "+27 71 234 5678",
  invoiceNumber: "INV-20260822-TEST01", createdAt: new Date("2026-08-22T10:00:00Z"),
  dueDate: new Date("2026-08-29T10:00:00Z"), description: "Handbags",
  serviceDetails: "Air freight", quantity: 1, subtotal: 637.23,
  additionalCharges: 22, total: 659.23, currency: "ZAR",
  // This fixture represents whichever tenant is currently authenticated. The
  // image is local test data only; production receives the workspace logo URL.
  businessName: "Acme Freight", supportEmail: "accounts@acmefreight.test",
  logoUrl: `data:image/png;base64,${readFileSync(new URL("../../../olyxee-admin/public/favicon.png", import.meta.url)).toString("base64")}`,
  paymentDetails: "Bank: FNB\nAccount: 62123456789", paymentTerms: "Due within 7 days",
  primaryColor: "#146C94", jobNumber: "JOB-20260822-X7KM",
  origin: "Shenzhen, China", destination: "Johannesburg, South Africa",
  transportMode: "AIR", weight: "3.2 kg",
};

describe("invoice email delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM_ADDRESS = "billing@example.com";
    mocks.send.mockResolvedValue({ data: { id: "email_1" }, error: null });
  });

  it("sends a visible message and the current PDF attachment together", async () => {
    const result = await sendInvoiceEmail(invoice);

    expect(result).toEqual({ success: true, messageId: "email_1" });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    const payload = mocks.send.mock.calls[0][0];
    expect(payload.html).toContain("Your invoice is ready");
    expect(payload.html).toContain("Hi Thabo Nkosi,");
    expect(payload.html).toContain("Please find your PDF invoice attached below");
    // Data-URL logos belong in the attached PDF, not the email HTML. Large
    // inline base64 images are rejected or stripped by email providers.
    expect(payload.html).not.toContain("data:image/");
    expect(payload.html).toContain("Acme Freight");
    expect(payload.html).toContain("JOB-20260822-X7KM");
    expect(payload.text).toContain("Your invoice from Acme Freight is ready");
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments[0].filename).toBe("INV-20260822-TEST01.pdf");
    expect(Buffer.isBuffer(payload.attachments[0].content)).toBe(true);
    expect(payload.attachments[0].content.subarray(0, 4).toString()).toBe("%PDF");
    expect(payload.attachments[0].content.toString("latin1")).toContain("/Subtype /Image");
  });

  it("does not let an invalid tenant reply-to address block delivery", async () => {
    const result = await sendInvoiceEmail({ ...invoice, supportEmail: "not configured" });

    expect(result).toEqual({ success: true, messageId: "email_1" });
    const payload = mocks.send.mock.calls[0][0];
    expect(payload).not.toHaveProperty("replyTo");
    expect(payload.attachments[0].content.toString("latin1")).toContain("/Subtype /Image");
  });
});
