import { describe,expect,it } from "vitest";
import { canConfirmInvoicePaid } from "../lib/invoice-workflow";

describe("manual invoice payment",()=>{
 it("requires an invoice to be sent before staff confirms payment",()=>{
  expect(canConfirmInvoicePaid("draft")).toBe(false);
  expect(canConfirmInvoicePaid("cancelled")).toBe(false);
  expect(canConfirmInvoicePaid("sent")).toBe(true);
  expect(canConfirmInvoicePaid("overdue")).toBe(true);
  expect(canConfirmInvoicePaid("paid")).toBe(true);
 });
});
