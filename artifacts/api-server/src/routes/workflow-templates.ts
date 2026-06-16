import { Router } from "express";
import { db, workflowTemplatesTable, workflowStepsTable, businessWorkflowsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { generateId } from "../lib/id";
import { z } from "zod";

const router = Router();

// ─── Serializers ─────────────────────────────────────────────────────────────

function serializeTemplate(t: typeof workflowTemplatesTable.$inferSelect) {
  return { ...t, createdAt: t.createdAt.toISOString() };
}

async function getTemplateWithSteps(businessId: string, templateId: string) {
  const template = await db.query.workflowTemplatesTable.findFirst({
    where: and(
      eq(workflowTemplatesTable.id, templateId),
      eq(workflowTemplatesTable.businessId, businessId),
    ),
  });
  if (!template) return null;

  const steps = await db
    .select()
    .from(workflowStepsTable)
    .where(eq(workflowStepsTable.templateId, templateId))
    .orderBy(workflowStepsTable.position);

  return { ...serializeTemplate(template), steps };
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const StepInputSchema = z.object({
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  position: z.number().int().min(0),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  isTerminal: z.boolean().default(false),
});

const CreateTemplateBody = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  businessType: z.string().optional(),
  steps: z.array(StepInputSchema).min(1).max(50),
});

const UpdateTemplateBody = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullish(),
  businessType: z.string().nullish(),
});

const CloneTemplateBody = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  businessType: z.string().optional(),
  steps: z.array(StepInputSchema).min(1).max(50),
});

const UpdateStepsBody = z.object({
  steps: z.array(StepInputSchema).min(1).max(50),
});

const ActivateWorkflowBody = z.object({
  templateId: z.string().min(1),
  templateName: z.string().min(1),
});

// ─── GET /workflow-templates ──────────────────────────────────────────────────

router.get("/workflow-templates", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const templates = await db
      .select()
      .from(workflowTemplatesTable)
      .where(eq(workflowTemplatesTable.businessId, businessId))
      .orderBy(workflowTemplatesTable.createdAt);

    const withSteps = await Promise.all(
      templates.map(async (t) => {
        const steps = await db
          .select()
          .from(workflowStepsTable)
          .where(eq(workflowStepsTable.templateId, t.id))
          .orderBy(workflowStepsTable.position);
        return { ...serializeTemplate(t), steps };
      }),
    );

    res.json(withSteps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list workflow templates" });
  }
});

// ─── POST /workflow-templates ─────────────────────────────────────────────────

router.post("/workflow-templates", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const parsed = CreateTemplateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }
    const { name, description, businessType, steps } = parsed.data;
    const templateId = generateId();

    await db.insert(workflowTemplatesTable).values({
      id: templateId,
      businessId,
      name,
      description: description ?? null,
      businessType: businessType ?? null,
    });

    await db.insert(workflowStepsTable).values(
      steps.map((s) => ({
        id: generateId(),
        templateId,
        label: s.label,
        description: s.description ?? null,
        position: s.position,
        color: s.color ?? null,
        isTerminal: s.isTerminal,
      })),
    );

    const result = await getTemplateWithSteps(businessId, templateId);
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create workflow template" });
  }
});

// ─── GET /workflow-templates/:id ─────────────────────────────────────────────

router.get("/workflow-templates/:id", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const result = await getTemplateWithSteps(businessId, req.params.id);
    if (!result) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get workflow template" });
  }
});

// ─── PUT /workflow-templates/:id ─────────────────────────────────────────────

router.put("/workflow-templates/:id", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const parsed = UpdateTemplateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const existing = await db.query.workflowTemplatesTable.findFirst({
      where: and(
        eq(workflowTemplatesTable.id, req.params.id),
        eq(workflowTemplatesTable.businessId, businessId),
      ),
    });
    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.businessType !== undefined) updates.businessType = parsed.data.businessType;

    if (Object.keys(updates).length > 0) {
      await db
        .update(workflowTemplatesTable)
        .set(updates)
        .where(eq(workflowTemplatesTable.id, req.params.id));
    }

    const result = await getTemplateWithSteps(businessId, req.params.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update workflow template" });
  }
});

// ─── DELETE /workflow-templates/:id ──────────────────────────────────────────

router.delete("/workflow-templates/:id", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const existing = await db.query.workflowTemplatesTable.findFirst({
      where: and(
        eq(workflowTemplatesTable.id, req.params.id),
        eq(workflowTemplatesTable.businessId, businessId),
      ),
    });
    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    // Steps cascade-deleted via FK
    await db.delete(workflowTemplatesTable).where(eq(workflowTemplatesTable.id, req.params.id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete workflow template" });
  }
});

// ─── POST /workflow-templates/clone ──────────────────────────────────────────
// Accepts the full step list from the caller (works for both preset and DB
// source templates — the client resolves the steps before sending).

router.post("/workflow-templates/clone", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const parsed = CloneTemplateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
      return;
    }
    const { name, description, businessType, steps } = parsed.data;
    const templateId = generateId();

    await db.insert(workflowTemplatesTable).values({
      id: templateId,
      businessId,
      name,
      description: description ?? null,
      businessType: businessType ?? null,
    });

    await db.insert(workflowStepsTable).values(
      steps.map((s) => ({
        id: generateId(),
        templateId,
        label: s.label,
        description: s.description ?? null,
        position: s.position,
        color: s.color ?? null,
        isTerminal: s.isTerminal,
      })),
    );

    const result = await getTemplateWithSteps(businessId, templateId);
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to clone workflow template" });
  }
});

// ─── PUT /workflow-templates/:id/steps ───────────────────────────────────────

router.put("/workflow-templates/:id/steps", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const existing = await db.query.workflowTemplatesTable.findFirst({
      where: and(
        eq(workflowTemplatesTable.id, req.params.id),
        eq(workflowTemplatesTable.businessId, businessId),
      ),
    });
    if (!existing) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    const parsed = UpdateStepsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    // Atomic replace — delete all then insert new set
    await db.delete(workflowStepsTable).where(eq(workflowStepsTable.templateId, req.params.id));
    await db.insert(workflowStepsTable).values(
      parsed.data.steps.map((s) => ({
        id: generateId(),
        templateId: req.params.id,
        label: s.label,
        description: s.description ?? null,
        position: s.position,
        color: s.color ?? null,
        isTerminal: s.isTerminal,
      })),
    );

    const result = await getTemplateWithSteps(businessId, req.params.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update workflow steps" });
  }
});

// ─── GET /business-workflows/active ──────────────────────────────────────────

router.get("/business-workflows/active", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const active = await db.query.businessWorkflowsTable.findFirst({
      where: eq(businessWorkflowsTable.businessId, businessId),
    });
    if (!active) {
      res.status(404).json({ error: "No active workflow assigned" });
      return;
    }
    res.json({ ...active, assignedAt: active.assignedAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get active workflow" });
  }
});

// ─── POST /business-workflows/activate ───────────────────────────────────────

router.post("/business-workflows/activate", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const parsed = ActivateWorkflowBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const { templateId, templateName } = parsed.data;

    // Upsert: remove existing assignment then insert new one
    await db.delete(businessWorkflowsTable).where(eq(businessWorkflowsTable.businessId, businessId));
    const id = generateId();
    await db.insert(businessWorkflowsTable).values({
      id,
      businessId,
      templateId,
      templateName,
    });

    const result = await db.query.businessWorkflowsTable.findFirst({
      where: eq(businessWorkflowsTable.businessId, businessId),
    });
    res.json({ ...result!, assignedAt: result!.assignedAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to activate workflow" });
  }
});

export default router;
