import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import type { SendInvoiceEmailParams } from "./email";

// Keep the emailed attachment aligned with the structured invoice shown in the
// admin app. PDFKit is used instead of a headless browser so this remains
// reliable inside Vercel Functions.
export async function buildInvoicePdf(p: SendInvoiceEmailParams): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Invoice ${p.invoiceNumber}` } });
  // All content uses explicit A4 coordinates. A small bottom margin prevents
  // PDFKit from moving the final footer text onto an otherwise blank page.
  doc.page.margins.bottom = 8;
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const money = (value: number) => `${p.currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = (value: Date) => value.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
  const brand = /^#[0-9a-f]{6}$/i.test(p.primaryColor || "") ? p.primaryColor! : "#10243e";
  const ink = "#1d2733", muted = "#64748b", line = "#dbe3ec", pale = "#f8fafc";

  if (p.logoUrl) {
    try {
      // Use a data URL with the standalone build. Its internal Buffer shim is
      // different from Node's Buffer, so passing a Node Buffer makes it fall
      // through to fs.readFileSync. Data URLs are decoded by PDFKit itself and
      // remain safe inside a filesystem-free Vercel Function bundle.
      let logo: string | null = null;
      const dataMatch = p.logoUrl.match(/^data:image\/(png|jpe?g);base64,([a-z0-9+/=]+)$/i);
      if (dataMatch) {
        const decoded = Buffer.from(dataMatch[2], "base64");
        if (decoded.length <= 1_500_000) logo = p.logoUrl;
      } else if (/^https?:\/\//i.test(p.logoUrl)) {
        const response = await fetch(p.logoUrl, { signal: AbortSignal.timeout(5000) });
        const type = response.headers.get("content-type") ?? "";
        if (response.ok && /^image\/(png|jpe?g)/i.test(type)) {
          const downloaded = Buffer.from(await response.arrayBuffer());
          if (downloaded.length <= 1_500_000) logo = `data:${type.split(";")[0]};base64,${downloaded.toString("base64")}`;
        }
      }
      if (logo) doc.image(logo, 48, 46, { fit: [132, 42] });
    } catch {
      // The issuer name below remains the safe fallback.
    }
  }

  doc.rect(0, 0, 595.28, 8).fill(brand);
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(18).text(p.businessName, 48, 102, { width: 300 });
  const issuerLines = [
    p.companyRegistration ? `Reg No. ${p.companyRegistration}` : null,
    p.taxNumber ? `Tax No. ${p.taxNumber}` : null,
    p.supportEmail, p.businessPhone, p.businessAddress,
  ].filter(Boolean).join("\n");
  doc.fillColor(muted).font("Helvetica").fontSize(8.5).text(issuerLines, 48, 127, { width: 300, height: 58, ellipsis: true, lineGap: 2 });
  doc.fillColor(brand).font("Helvetica-Bold").fontSize(25).text("Invoice", 365, 48, { width: 182, align: "right" });
  doc.fillColor(muted).font("Courier").fontSize(9).text(p.invoiceNumber, 365, 82, { width: 182, align: "right" });
  doc.roundedRect(414, 105, 133, 25, 12).fill("#fff7ed");
  doc.fillColor("#b45309").font("Helvetica-Bold").fontSize(8).text("PENDING PAYMENT", 422, 114, { width: 117, align: "center" });

  const boxY = 198;
  doc.rect(48, boxY, 499, 124).lineWidth(1).strokeColor(line).stroke();
  doc.moveTo(326, boxY).lineTo(326, boxY + 124).stroke();
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(7.5).text("BILLED TO", 62, boxY + 16, { characterSpacing: 0.7 });
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(12).text(p.customerName, 62, boxY + 34, { width: 242 });
  const customerLines = [p.customerAddress, p.customerEmail, p.customerPhone].filter(Boolean).join("\n");
  doc.fillColor(muted).font("Helvetica").fontSize(8.5).text(customerLines || "Address not supplied", 62, boxY + 55, { width: 242, height: 57, ellipsis: true, lineGap: 2 });
  const detailRows = [
    ["INVOICE NUMBER", p.invoiceNumber], ["ISSUE DATE", date(p.createdAt)],
    ["DUE DATE", date(p.dueDate)], ["JOB REFERENCE", p.jobNumber || p.orderReference || "-"],
  ];
  detailRows.forEach(([label, value], index) => {
    const y = boxY + index * 31;
    if (index > 0) doc.moveTo(326, y).lineTo(547, y).strokeColor(line).stroke();
    doc.fillColor(muted).font("Helvetica-Bold").fontSize(6.5).text(label, 340, y + 11, { width: 90 });
    doc.fillColor(ink).font(index === 0 ? "Courier" : "Helvetica-Bold").fontSize(8).text(value, 427, y + 10, { width: 106, align: "right", ellipsis: true });
  });

  doc.fillColor(muted).font("Helvetica-Bold").fontSize(7.5).text("SHIPMENT REFERENCE", 48, 344, { characterSpacing: 0.7 });
  const shipmentY = 360;
  const transport = p.transportMode ? `${p.transportMode.charAt(0)}${p.transportMode.slice(1).toLowerCase()} freight` : "-";
  const shipmentCells = [
    ["CARGO", p.description || "-", "TRANSPORT", transport],
    ["ORIGIN", p.origin || "-", "DESTINATION", p.destination || "-"],
  ];
  doc.rect(48, shipmentY, 499, 68).strokeColor(line).stroke();
  doc.moveTo(48, shipmentY + 34).lineTo(547, shipmentY + 34).stroke();
  doc.moveTo(297, shipmentY).lineTo(297, shipmentY + 68).stroke();
  shipmentCells.forEach((row, rowIndex) => {
    const y = shipmentY + rowIndex * 34;
    [[48, row[0], row[1]], [297, row[2], row[3]]].forEach(([x, label, value]) => {
      doc.rect(Number(x), y, 76, 34).fill(pale);
      doc.fillColor(muted).font("Helvetica-Bold").fontSize(6.5).text(String(label), Number(x) + 10, y + 13, { width: 60 });
      doc.fillColor(ink).font("Helvetica-Bold").fontSize(8.5).text(String(value), Number(x) + 86, y + 12, { width: 153, height: 12, ellipsis: true });
    });
  });

  doc.fillColor(muted).font("Helvetica-Bold").fontSize(7.5).text("INVOICE ITEMS", 48, 452, { characterSpacing: 0.7 });
  const itemsY = 468;
  doc.rect(48, itemsY, 499, 32).fill(brand);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.5)
    .text("DESCRIPTION", 60, itemsY + 12, { width: 292 })
    .text("QTY", 357, itemsY + 12, { width: 36, align: "center" })
    .text("RATE", 397, itemsY + 12, { width: 64, align: "right" })
    .text("AMOUNT", 469, itemsY + 12, { width: 66, align: "right" });
  const chargeDescription = [transport || "Logistics service", p.description, p.weight].filter(Boolean).join(" - ");
  const itemRows = [[chargeDescription, "1", money(p.subtotal), money(p.subtotal)]];
  if (p.additionalCharges > 0) itemRows.push(["Additional charges", "1", money(p.additionalCharges), money(p.additionalCharges)]);
  itemRows.forEach((row, index) => {
    const y = itemsY + 32 + index * 38;
    doc.rect(48, y, 499, 38).strokeColor(line).stroke();
    doc.fillColor(index === 0 ? ink : muted).font(index === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).text(row[0], 60, y + 14, { width: 292, height: 12, ellipsis: true });
    doc.fillColor(muted).font("Helvetica").text(row[1], 357, y + 14, { width: 36, align: "center" }).text(row[2], 397, y + 14, { width: 64, align: "right" });
    doc.fillColor(ink).font("Helvetica-Bold").text(row[3], 469, y + 14, { width: 66, align: "right" });
  });

  const totalsY = itemsY + 32 + itemRows.length * 38;
  const totals = [["Subtotal", money(p.subtotal)]];
  if (p.additionalCharges > 0) totals.push(["Additional charges", money(p.additionalCharges)]);
  totals.push(["VAT", "Not separately charged"]);
  totals.forEach(([label, value], index) => {
    const y = totalsY + index * 24;
    doc.rect(327, y, 220, 24).strokeColor(line).stroke();
    doc.fillColor(muted).font("Helvetica").fontSize(8).text(label, 339, y + 9, { width: 95 });
    doc.fillColor(ink).font("Helvetica-Bold").text(value, 437, y + 9, { width: 98, align: "right" });
  });
  const totalY = totalsY + totals.length * 24;
  doc.rect(327, totalY, 220, 34).strokeColor(line).stroke();
  doc.fillColor(brand).font("Helvetica-Bold").fontSize(9).text("TOTAL DUE", 339, totalY + 13, { width: 85 });
  doc.fontSize(14).text(money(p.total), 424, totalY + 9, { width: 111, align: "right" });

  const paymentY = Math.max(664, totalY + 38);
  doc.rect(48, paymentY, 499, 84).fill(pale).strokeColor(line).stroke();
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(7.5).text("HOW TO PAY", 64, paymentY + 16, { characterSpacing: 0.7 });
  doc.fillColor(ink).font("Helvetica").fontSize(7.5).text(p.paymentDetails || "Contact the issuer for payment instructions.", 64, paymentY + 34, { width: 276, height: 44, ellipsis: true, lineGap: 1 });
  doc.moveTo(365, paymentY + 14).lineTo(365, paymentY + 70).strokeColor(line).stroke();
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(6.5).text("PAYMENT REFERENCE", 382, paymentY + 18);
  doc.fillColor(ink).font("Courier").fontSize(8).text(p.invoiceNumber, 382, paymentY + 32, { width: 148, ellipsis: true });
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(6.5).text("TERMS", 382, paymentY + 53);
  doc.fillColor(ink).font("Helvetica").fontSize(7.5).text(p.paymentTerms || "Payment due on receipt.", 382, paymentY + 66, { width: 148, height: 15, ellipsis: true });

  if (p.footerNote) doc.fillColor(muted).font("Helvetica").fontSize(7.5).text(p.footerNote, 48, 771, { width: 499, align: "center", height: 11, ellipsis: true });
  doc.moveTo(48, 798).lineTo(547, 798).strokeColor(line).stroke();
  doc.fillColor(muted).font("Helvetica").fontSize(7).text(`${p.businessName}  |  ${p.supportEmail}`, 48, 806, { width: 499, align: "center", lineBreak: false });
  doc.end();
  return complete;
}
