// ─── Order lifecycle FSM ──────────────────────────────────────────────────────
// Uses the same status vocabulary as @workspace/order-statuses so the admin
// UI, the email templates, and the FSM all share a single source of truth.

import { and, eq, inArray } from "drizzle-orm";
import {
  db as defaultDb,
  ordersTable,
  trackingEventsTable,
  auditLogsTable,
} from "@workspace/db";
import {
  ORDER_STATUSES,
  type OrderStatus,
  nextStatuses,
  isTerminal,
} from "@workspace/order-statuses";
import { generateId } from "./id";

// ─── Vocabulary ──────────────────────────────────────────────────────────────
export const FSM_ORDER_STATUSES = ORDER_STATUSES;
export type OrderFsmStatus = OrderStatus;

export const INITIAL_STATUS: OrderFsmStatus = "Order received";

export function isFsmStatus(s: string): s is OrderFsmStatus {
  return (FSM_ORDER_STATUSES as readonly string[]).includes(s);
}

// ─── Transition table ────────────────────────────────────────────────────────
// Derived directly from @workspace/order-statuses so there's a single
// source of truth for allowed transitions.
export const VALID_TRANSITIONS: Readonly<
  Record<OrderFsmStatus, readonly OrderFsmStatus[]>
> = Object.fromEntries(
  ORDER_STATUSES.map((s) => [s, nextStatuses(s)]),
) as unknown as Record<OrderFsmStatus, readonly OrderFsmStatus[]>;

export function canTransition(from: OrderFsmStatus, to: OrderFsmStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

// ─── Validation ──────────────────────────────────────────────────────────────
export type ValidationResult =
  | { ok: true }
  | { ok: false; code: "invalid_transition" | "unknown_status" | "terminal_state"; message: string };

export function validateTransition(from: string, to: string): ValidationResult {
  if (!isFsmStatus(from)) {
    return {
      ok: false,
      code: "unknown_status",
      message: `Order status "${from}" is not a valid lifecycle status. Expected one of: ${FSM_ORDER_STATUSES.join(", ")}.`,
    };
  }
  if (!isFsmStatus(to)) {
    return {
      ok: false,
      code: "unknown_status",
      message: `Target status "${to}" is not a valid lifecycle status.`,
    };
  }
  if (isTerminal(from)) {
    return {
      ok: false,
      code: "terminal_state",
      message: `Order is already "${from}" - no further transitions are allowed.`,
    };
  }
  if (!canTransition(from, to)) {
    const allowed = VALID_TRANSITIONS[from].join(", ") || "none";
    return {
      ok: false,
      code: "invalid_transition",
      message: `Cannot move from "${from}" to "${to}". Allowed next steps: ${allowed}.`,
    };
  }
  return { ok: true };
}

// ─── Stuck-order detection ───────────────────────────────────────────────────
export const STUCK_THRESHOLDS_MS: Partial<Record<OrderFsmStatus, number>> = {
  "Order received": 24 * 60 * 60 * 1000,
  "Processing":     48 * 60 * 60 * 1000,
  "In transit":     72 * 60 * 60 * 1000,
  "Delayed":        48 * 60 * 60 * 1000,
};

export function isStuck(
  status: string,
  lastUpdatedAt: Date,
  now: Date = new Date(),
): boolean {
  if (!isFsmStatus(status)) return false;
  const threshold = STUCK_THRESHOLDS_MS[status];
  if (threshold === undefined) return false;
  return now.getTime() - lastUpdatedAt.getTime() > threshold;
}

// ─── Core transition function ────────────────────────────────────────────────
export interface TransitionInput {
  orderId: string;
  businessId: string;
  toStatus: OrderFsmStatus;
  updatedBy: string;
  reason?: string | null;
}

export interface TransitionSuccess {
  success: true;
  currentStatus: OrderFsmStatus;
  message: string;
  eventId: string;
}

export interface TransitionFailure {
  success: false;
  currentStatus: string | null;
  message: string;
  eventId: null;
  code: "not_found" | "invalid_transition" | "unknown_status" | "terminal_state";
}

export type TransitionResult = TransitionSuccess | TransitionFailure;

export async function transitionOrder(
  input: TransitionInput,
  database: typeof defaultDb = defaultDb,
): Promise<TransitionResult> {
  const { orderId, businessId, toStatus, updatedBy, reason } = input;

  const order = await database.query.ordersTable.findFirst({
    where: and(
      eq(ordersTable.id, orderId),
      eq(ordersTable.businessId, businessId),
    ),
  });

  if (!order) {
    return {
      success: false,
      currentStatus: null,
      message: "Order not found.",
      eventId: null,
      code: "not_found",
    };
  }

  const previousStatus = order.currentStatus;
  const validation = validateTransition(previousStatus, toStatus);
  if (!validation.ok) {
    return {
      success: false,
      currentStatus: previousStatus,
      message: validation.message,
      eventId: null,
      code: validation.code,
    };
  }

  const eventId = await database.transaction(async (tx) => {
    const newEventId = generateId();

    const noteParts = [`${previousStatus} → ${toStatus}`];
    if (reason && reason.trim()) noteParts.push(reason.trim());
    await tx.insert(trackingEventsTable).values({
      id: newEventId,
      orderId,
      status: toStatus,
      message: noteParts.join(" - "),
      createdBy: updatedBy,
    });

    const updated = await tx
      .update(ordersTable)
      .set({ currentStatus: toStatus, updatedAt: new Date() })
      .where(
        and(
          eq(ordersTable.id, orderId),
          eq(ordersTable.businessId, businessId),
          eq(ordersTable.currentStatus, previousStatus),
        ),
      )
      .returning({ id: ordersTable.id });

    if (updated.length === 0) {
      throw new ConcurrentTransitionError(orderId);
    }

    await tx.insert(auditLogsTable).values({
      id: generateId(),
      businessId,
      userId: updatedBy,
      action: "ORDER_STATUS_TRANSITION",
      entityType: "order",
      entityId: orderId,
      metadata: {
        previousStatus,
        newStatus: toStatus,
        reason: reason?.trim() || null,
        eventId: newEventId,
      },
    });

    return newEventId;
  });

  return {
    success: true,
    currentStatus: toStatus,
    message: `Order moved from "${previousStatus}" to "${toStatus}".`,
    eventId,
  };
}

export class ConcurrentTransitionError extends Error {
  constructor(public readonly orderId: string) {
    super(`Order ${orderId} was modified by another request`);
    this.name = "ConcurrentTransitionError";
  }
}

// ─── Stuck order query ───────────────────────────────────────────────────────
export interface StuckOrder {
  orderId: string;
  trackingId: string;
  currentStatus: OrderFsmStatus;
  updatedAt: string;
  stuckForMs: number;
  thresholdMs: number;
  reason: string;
}

function formatHours(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  return `${hours}h`;
}

export async function findStuckOrders(
  businessId: string,
  now: Date = new Date(),
  database: typeof defaultDb = defaultDb,
): Promise<StuckOrder[]> {
  const watched = Object.keys(STUCK_THRESHOLDS_MS) as OrderFsmStatus[];

  const candidates = await database
    .select({
      id: ordersTable.id,
      trackingId: ordersTable.trackingId,
      currentStatus: ordersTable.currentStatus,
      updatedAt: ordersTable.updatedAt,
    })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.businessId, businessId),
        inArray(ordersTable.currentStatus, watched),
      ),
    );

  const stuck: StuckOrder[] = [];
  for (const row of candidates) {
    if (!isFsmStatus(row.currentStatus)) continue;
    const threshold = STUCK_THRESHOLDS_MS[row.currentStatus];
    if (threshold === undefined) continue;
    const stuckForMs = now.getTime() - row.updatedAt.getTime();
    if (stuckForMs <= threshold) continue;
    stuck.push({
      orderId: row.id,
      trackingId: row.trackingId,
      currentStatus: row.currentStatus,
      updatedAt: row.updatedAt.toISOString(),
      stuckForMs,
      thresholdMs: threshold,
      reason: `Stuck in "${row.currentStatus}" for ${formatHours(stuckForMs)} (threshold ${formatHours(threshold)}).`,
    });
  }

  stuck.sort((a, b) => b.stuckForMs - a.stuckForMs);
  return stuck;
}
