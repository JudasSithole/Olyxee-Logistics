import { statusCopy } from "@workspace/order-statuses";

export interface SendStatusSmsParams {
  businessName: string;
  trackingId: string;
  status: string;
  statusMessage: string | null;
  trackingLink: string;
  customerPhone: string;
}

// Build a concise status SMS. Targets under 160 chars for standard GSM SMS.
// Truncates the body if it runs long so SMSPortal never rejects it.
export function buildSmsBody(params: SendStatusSmsParams): string {
  const c = statusCopy(params.status);
  const parts: string[] = [];

  // Lead with business name + tracking ID so the recipient knows who it's from.
  parts.push(`${params.businessName}: ${params.trackingId}`);

  // Use the email headline as the status line but truncate aggressively.
  const headline = c.headline.replace(/^Your\s+/i, "").trim();
  parts.push(headline);

  // Optional admin note - only include if there's room.
  if (params.statusMessage && params.statusMessage.trim()) {
    const note = params.statusMessage.trim();
    parts.push(note.length <= 60 ? note : `${note.slice(0, 57)}...`);
  }

  // Tracking link - always include if we have one.
  const safeLink = params.trackingLink?.trim();
  if (safeLink) {
    parts.push(safeLink);
  }

  const body = parts.join(" | ");

  // SMSPortal handles concatenation, but long messages cost more and feel
  // like spam. Cap at 160 chars for a single segment.
  if (body.length > 160) {
    const linkLen = safeLink ? safeLink.length + 3 : 0;
    const maxContent = 160 - linkLen - 3; // 3 for " | "
    const truncated = body.slice(0, maxContent);
    const lastSpace = truncated.lastIndexOf(" ");
    const trimmed = lastSpace > maxContent - 20 ? truncated.slice(0, lastSpace) : truncated;
    return `${trimmed}...${safeLink ? ` | ${safeLink}` : ""}`;
  }

  return body;
}
