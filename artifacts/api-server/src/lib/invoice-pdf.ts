import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { SendInvoiceEmailParams } from "./email";

export async function buildInvoicePdf(p: SendInvoiceEmailParams): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Invoice ${p.invoiceNumber}` } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const money = (value: number) => `${p.currency} ${value.toFixed(2)}`;
  const date = (value: Date) => value.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });

  if (p.logoUrl && /^https?:\/\//i.test(p.logoUrl)) {
    try {
      const response = await fetch(p.logoUrl, { signal: AbortSignal.timeout(5000) });
      if (response.ok) doc.image(Buffer.from(await response.arrayBuffer()), 48, 44, { fit: [150, 62] });
    } catch { /* The business name remains as the safe logo fallback. */ }
  }
  doc.font("Helvetica-Bold").fontSize(22).text(p.businessName, 48, 112);
  doc.font("Helvetica").fontSize(9).fillColor("#475569")
    .text([p.supportEmail, p.businessPhone, p.businessAddress].filter(Boolean).join(" | "), 48, 140, { width: 310 });
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(20).text("INVOICE", 390, 52, { align: "right", width: 155 });
  doc.font("Helvetica").fontSize(10)
    .text(p.invoiceNumber, 390, 80, { align: "right", width: 155 })
    .text(`Created: ${date(p.createdAt)}`, 390, 98, { align: "right", width: 155 })
    .text(`Due: ${date(p.dueDate)}`, 390, 114, { align: "right", width: 155 })
    .fillColor("#b45309").font("Helvetica-Bold").text("STATUS: PENDING PAYMENT", 350, 136, { align: "right", width: 195 });

  doc.moveTo(48, 174).lineTo(547, 174).strokeColor("#cbd5e1").stroke();
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text("BILL TO", 48, 196);
  doc.font("Helvetica").fontSize(11).text(p.customerName, 48, 216);
  if (p.customerAddress) doc.fillColor("#475569").fontSize(9).text(p.customerAddress, 48, 234, { width: 300 });

  const top = 290;
  doc.rect(48, top, 499, 30).fill("#e2e8f0");
  doc.fillColor("#475569").font("Helvetica-Bold").fontSize(9)
    .text("ITEM", 58, top + 10).text("QTY", 350, top + 10, { width: 40, align: "right" })
    .text("RATE", 395, top + 10, { width: 70, align: "right" }).text("AMOUNT", 470, top + 10, { width: 67, align: "right" });
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text(p.description, 58, top + 45, { width: 275 });
  doc.font("Helvetica").fillColor("#64748b").fontSize(9).text(p.serviceDetails, 58, top + 62, { width: 275 });
  doc.fillColor("#0f172a").fontSize(10).text(String(p.quantity), 350, top + 46, { width: 40, align: "right" })
    .text(money(p.subtotal), 395, top + 46, { width: 70, align: "right" }).font("Helvetica-Bold").text(money(p.subtotal), 470, top + 46, { width: 67, align: "right" });
  let totalY = top + 100;
  if (p.additionalCharges > 0) {
    doc.font("Helvetica").text("Additional charges", 330, totalY).text(money(p.additionalCharges), 470, totalY, { width: 67, align: "right" });
    totalY += 24;
  }
  doc.moveTo(330, totalY).lineTo(547, totalY).strokeColor("#cbd5e1").stroke();
  doc.font("Helvetica-Bold").fontSize(15).text("TOTAL", 330, totalY + 14).text(money(p.total), 430, totalY + 14, { width: 107, align: "right" });

  const payY = Math.max(500, totalY + 72);
  doc.fontSize(11).text("PAYMENT DETAILS", 48, payY);
  doc.font("Helvetica").fontSize(10).text("Account name: FREIGHTSHIFT INTERNATIONAL LOGISTICS (PTY) LTD\nBank: FNB\nAccount number: 63214036732\nBranch code: 256505\nAccount type: GOLD BUSINESS ACCOUNT\nReference: " + `${p.customerName} (${p.description})`, 48, payY + 22, { lineGap: 4 });
  doc.font("Helvetica-Bold").fontSize(10).text("PAYMENT REQUIRED", 48, 700);
  doc.font("Helvetica").fillColor("#475569").fontSize(9).text("Shipment status updates begin only after Olyxee Logistics manually confirms payment.", 48, 718);
  doc.end();
  return complete;
}
