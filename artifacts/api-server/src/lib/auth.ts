import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { SESSION_COOKIE, verifySession } from "./session";
import { DEMO_USER_ID, DEMO_BUSINESS_ID } from "../routes/auth";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = (req as any).cookies?.[SESSION_COOKIE] as string | undefined;
  const payload = verifySession(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Demo session - fully hardcoded, no database needed.
  if (payload.userId === DEMO_USER_ID) {
    (req as any).businessId = DEMO_BUSINESS_ID;
    (req as any).userId = DEMO_USER_ID;
    next();
    return;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, payload.userId),
  });
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  (req as any).businessId = user.businessId;
  (req as any).userId = user.id;
  next();
}
