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
  const money = (value: number) =>
    `${p.currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = (value: Date) => value.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });

  if (p.logoUrl) {
    try {
      let logo: Buffer | null = null;
      const dataMatch = p.logoUrl.match(/^data:image\/(png|jpe?g);base64,([a-z0-9+/=]+)$/i);
      if (dataMatch) {
        const decoded = Buffer.from(dataMatch[2], "base64");
        if (decoded.length <= 1_500_000) logo = decoded;
      } else if (/^https?:\/\//i.test(p.logoUrl)) {
        const response = await fetch(p.logoUrl, { signal: AbortSignal.timeout(5000) });
        const type = response.headers.get("content-type") ?? "";
        if (response.ok && /^image\/(png|jpe?g)/i.test(type)) {
          const downloaded = Buffer.from(await response.arrayBuffer());
          if (downloaded.length <= 1_500_000) logo = downloaded;
        }
      }
      if (logo) doc.image(logo, 48, 54, { fit: [128, 48] });
    } catch { /* The business name remains as the safe logo fallback. */ }
  }
  const navy = /^#[0-9a-f]{6}$/i.test(p.primaryColor || "") ? p.primaryColor! : "#10243e";
  const ink = "#142033", muted = "#64748b", line = "#dbe3ec", pale = "#f4f7fb";
  doc.rect(0, 0, 595.28, 12).fill(navy);
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(20).text(p.businessName, 48, 112, { width: 300 });
  doc.font("Helvetica").fontSize(8.5).fillColor(muted).text([p.supportEmail, p.businessPhone].filter(Boolean).join("  |  "), 48, 140, { width: 300 });
  if (p.businessAddress) doc.text(p.businessAddress, 48, 155, { width: 300, height: 32, ellipsis: true });
  const legal = [p.companyRegistration ? `REG ${p.companyRegistration}` : null, p.taxNumber ? `TAX ${p.taxNumber}` : null].filter(Boolean).join("  |  ");
  if (legal) doc.font("Helvetica-Bold").fontSize(7.5).text(legal, 48, 181, { width: 300 });

  doc.fillColor(navy).font("Helvetica-Bold").fontSize(27).text("INVOICE", 365, 51, { align: "right", width: 182, characterSpacing: 1.2 });
  doc.font("Helvetica").fontSize(9).fillColor(muted).text("INVOICE NUMBER", 365, 91, { align: "right", width: 182 });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(ink).text(p.invoiceNumber, 365, 105, { align: "right", width: 182 });
  doc.roundedRect(392, 130, 155, 28, 4).fill("#fff7ed");
  doc.fillColor("#b45309").font("Helvetica-Bold").fontSize(8.5).text("PENDING PAYMENT", 401, 140, { align: "center", width: 137, characterSpacing: 0.6 });

  doc.moveTo(48, 210).lineTo(547, 210).lineWidth(1).strokeColor(line).stroke();
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(8).text("BILL TO", 48, 232, { characterSpacing: 1 });
  doc.fillColor(ink).fontSize(13).text(p.customerName, 48, 249, { width: 260 });
  if (p.customerAddress) doc.fillColor(muted).font("Helvetica").fontSize(9).text(p.customerAddress, 48, 270, { width: 260, height: 36, ellipsis: true, lineGap: 2 });
  doc.fillColor(muted).font("Helvetica").fontSize(8).text(p.customerEmail, 48, 307, {width:260});
  if (p.customerPhone) doc.text(p.customerPhone, 48, 319, {width:260});
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(8).text("ISSUE DATE", 360, 232).text("DUE DATE", 465, 232);
  doc.fillColor(ink).font("Helvetica").fontSize(10).text(date(p.createdAt), 360, 249).text(date(p.dueDate), 465, 249);

  doc.fillColor(muted).font("Helvetica-Bold").fontSize(8).text("SHIPMENT SUMMARY", 48, 338, { characterSpacing: 1 });
  const transportLabel = p.transportMode ? `${p.transportMode.charAt(0)}${p.transportMode.slice(1).toLowerCase()} Freight` : "Not provided";
  const shipment = [
    ["Cargo", p.description], ["Route", [p.origin,p.destination].filter(Boolean).join(" -> ") || "Not provided"],
    ["Transport", transportLabel], ["Job Number", p.jobNumber || p.orderReference || "Not provided"],
  ];
  doc.roundedRect(48,350,499,50,4).fill(pale);
  shipment.forEach(([label, value], index) => { const x=60+index*122; doc.fillColor(muted).font("Helvetica-Bold").fontSize(7).text(label.toUpperCase(), x, 362, {width:112}); doc.fillColor(ink).font("Helvetica-Bold").fontSize(8.5).text(value, x, 377, {width:112,height:12,ellipsis:true}); });

  const top = 426;
  doc.roundedRect(48, top, 499, 34, 3).fill(navy);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8)
    .text("DESCRIPTION", 60, top + 13, { characterSpacing: 0.7 }).text("AMOUNT", 450, top + 13, { width: 85, align: "right" });
  const chargeDescription=[p.transportMode?transportLabel:"Logistics service",p.description,p.weight].filter(Boolean).join(" - ");
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(10.5).text(chargeDescription, 60, top + 51, { width: 340 });
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(10).text(money(p.subtotal), 450, top + 53, { width: 85, align: "right" });
  doc.moveTo(48, top + 91).lineTo(547, top + 91).strokeColor(line).stroke();
  let totalY = top + 107;
  if (p.additionalCharges > 0) {
    doc.fillColor(muted).font("Helvetica").fontSize(9).text("Additional charges", 337, totalY).fillColor(ink).text(money(p.additionalCharges), 455, totalY, { width: 80, align: "right" });
    totalY += 25;
  }
  doc.fillColor(muted).font("Helvetica").fontSize(8).text("VAT: Not separately charged",337,totalY+5,{width:210,align:"right"});
  doc.moveTo(337,totalY+23).lineTo(547,totalY+23).lineWidth(2).strokeColor(navy).stroke();
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(10).text("TOTAL DUE", 337, totalY + 36).fontSize(16).text(money(p.total), 417, totalY + 32, { width: 130, align: "right" });

  const payY = Math.max(610, totalY + 72);
  doc.roundedRect(48, payY, 499, 112, 5).fill(pale);
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(9).text("PAYMENT DETAILS", 64, payY + 18, { characterSpacing: 0.8 });
  doc.fillColor(ink).font("Helvetica").fontSize(8.7).text(p.paymentDetails || "Contact the issuer for payment instructions.", 64, payY + 39, { lineGap: 3, width: 275, height: 62, ellipsis: true });
  doc.moveTo(360,payY+18).lineTo(360,payY+94).lineWidth(1).strokeColor(line).stroke();
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(7).text("PAYMENT REFERENCE", 382, payY + 20).fillColor(ink).fontSize(9).text(p.invoiceNumber,382,payY+34,{width:145});
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(7).text("TERMS", 382, payY + 57).fillColor(ink).font("Helvetica").fontSize(8).text(p.paymentTerms || "Payment due on receipt.",382,payY+70,{width:145});

  if (p.footerNote) doc.fillColor(muted).font("Helvetica").fontSize(8).text(p.footerNote, 48, 762, { width: 499, align: "center", height: 12, ellipsis: true });
  doc.moveTo(48, 778).lineTo(547, 778).strokeColor(line).stroke();
  doc.fillColor(muted).font("Helvetica").fontSize(7.5).text(`${p.businessName}  |  ${p.supportEmail}  |  Page 1 of 1`, 48, 783, { width: 499, align: "center", lineBreak: false });
  doc.end();
  return complete;
}
