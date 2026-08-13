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
  const ink = "#142033", muted = "#64748b", line = "#dbe3ec", pale = "#f4f7fb", amber = "#b45309";
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
  doc.fillColor(amber).font("Helvetica-Bold").fontSize(8.5).text("PENDING PAYMENT", 401, 140, { align: "center", width: 137, characterSpacing: 0.6 });

  doc.moveTo(48, 210).lineTo(547, 210).lineWidth(1).strokeColor(line).stroke();
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(8).text("BILL TO", 48, 232, { characterSpacing: 1 });
  doc.fillColor(ink).fontSize(13).text(p.customerName, 48, 249, { width: 260 });
  if (p.customerAddress) doc.fillColor(muted).font("Helvetica").fontSize(9).text(p.customerAddress, 48, 270, { width: 260, height: 36, ellipsis: true, lineGap: 2 });
  doc.fillColor(muted).font("Helvetica").fontSize(8).text(p.customerEmail, 48, 307, {width:260});
  if (p.customerPhone) doc.text(p.customerPhone, 48, 319, {width:260});
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(8).text("ISSUE DATE", 360, 232).text("DUE DATE", 465, 232);
  doc.fillColor(ink).font("Helvetica").fontSize(10).text(date(p.createdAt), 360, 249).text(date(p.dueDate), 465, 249);

  doc.fillColor(muted).font("Helvetica-Bold").fontSize(8).text("SHIPMENT", 48, 338, { characterSpacing: 1 });
  const shipment = [
    ["Cargo", p.description], ["Transport", p.transportMode ? `${p.transportMode} Freight` : "Not provided"], ["Weight", p.weight || "Not provided"],
    ["Order Reference", p.orderReference || "Not provided"], ["Olyxee Tracking ID", p.trackingId || "Not assigned"],
    ["External Tracking Number", p.externalTrackingNumber || "Pending tracking number"], ["Origin", p.origin || "Not provided"], ["Destination", p.destination || "Not provided"],
  ];
  shipment.forEach(([label, value], index) => { const col=index%2,row=Math.floor(index/2),x=48+col*250,y=355+row*20; doc.fillColor(muted).font("Helvetica").fontSize(7.5).text(label, x, y, {width:90}); doc.fillColor(ink).font("Helvetica-Bold").text(value, x+92, y, {width:150,height:12,ellipsis:true}); });

  const top = 424;
  doc.roundedRect(48, top, 499, 34, 3).fill(navy);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8)
    .text("DESCRIPTION", 60, top + 13, { characterSpacing: 0.7 }).text("QTY", 350, top + 13, { width: 40, align: "right" })
    .text("RATE", 395, top + 13, { width: 70, align: "right" }).text("AMOUNT", 470, top + 13, { width: 65, align: "right" });
  const chargeDescription=[p.transportMode?`${p.transportMode} Freight`:"Logistics service",p.description,p.weight].filter(Boolean).join(" - ");
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(10.5).text(chargeDescription, 60, top + 51, { width: 270 });
  doc.fillColor(ink).fontSize(10).text(String(p.quantity), 350, top + 53, { width: 40, align: "right" })
    .text(money(p.subtotal), 395, top + 53, { width: 70, align: "right" }).font("Helvetica-Bold").text(money(p.subtotal), 470, top + 53, { width: 65, align: "right" });
  doc.moveTo(48, top + 106).lineTo(547, top + 106).strokeColor(line).stroke();
  let totalY = top + 122;
  if (p.additionalCharges > 0) {
    doc.fillColor(muted).font("Helvetica").fontSize(9).text("Additional charges", 337, totalY).fillColor(ink).text(money(p.additionalCharges), 455, totalY, { width: 80, align: "right" });
    totalY += 25;
  }
  doc.roundedRect(337, totalY, 210, 62, 4).fill(pale);
  doc.fillColor(muted).font("Helvetica").fontSize(8).text("Subtotal",351,totalY+9).text(money(p.total),420,totalY+9,{width:113,align:"right"}).text("VAT",351,totalY+23).text("Not separately charged",420,totalY+23,{width:113,align:"right"});
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(10).text("TOTAL DUE", 351, totalY + 43).fontSize(14).text(money(p.total), 420, totalY + 40, { width: 113, align: "right" });

  const payY = Math.max(620, totalY + 72);
  doc.roundedRect(48, payY, 315, 115, 5).fill(pale);
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(9).text("PAYMENT DETAILS", 64, payY + 18, { characterSpacing: 0.8 });
  doc.fillColor(ink).font("Helvetica").fontSize(8.7).text(`${p.paymentDetails || "Payment details have not been configured. Contact the issuer."}\n\nPayment Reference: ${p.invoiceNumber}`, 64, payY + 39, { lineGap: 3, width: 282, height: 78, ellipsis: true });
  doc.fillColor(navy).font("Helvetica-Bold").fontSize(9).text("PAYMENT TERMS", 391, payY + 18, { characterSpacing: 0.8 });
  doc.fillColor(muted).font("Helvetica").fontSize(8.7).text(p.paymentTerms || "Payment due within agreed terms.", 391, payY + 39, { width: 156, lineGap: 3 });
  doc.fillColor(amber).font("Helvetica-Bold").fontSize(8).text("SHIPMENT STATUS UPDATES BECOME AVAILABLE AFTER PAYMENT IS CONFIRMED.", 391, payY + 76, { width: 156, lineGap: 2 });

  if (p.footerNote) doc.fillColor(muted).font("Helvetica").fontSize(8).text(p.footerNote, 48, 762, { width: 499, align: "center", height: 12, ellipsis: true });
  doc.moveTo(48, 778).lineTo(547, 778).strokeColor(line).stroke();
  doc.fillColor(muted).font("Helvetica").fontSize(7.5).text(`${p.businessName}  |  ${p.supportEmail}  |  Page 1 of 1`, 48, 783, { width: 499, align: "center", lineBreak: false });
  doc.end();
  return complete;
}
