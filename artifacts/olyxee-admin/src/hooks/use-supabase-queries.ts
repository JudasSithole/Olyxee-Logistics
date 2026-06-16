/**
 * API query hooks
 *
 * All data fetching hooks for the app live here.
 * They use TanStack Query (useQuery / useMutation) against the Olyxee Express
 * API (served under `/api`). The hook names, signatures, query keys and return
 * shapes are kept identical to the previous Supabase implementation so the
 * pages and components remain unchanged. Each handler maps the API's camelCase
 * DTOs to the snake_case row shapes the UI expects.
 *
 * Pattern:
 *   useXxx()        → read (useQuery)
 *   useCreateXxx()  → insert (useMutation)
 *   useUpdateXxx()  → update (useMutation)
 *   useDeleteXxx()  → delete (useMutation)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type {
  Business,
  Customer,
  InsertCustomer,
  InsertOrder,
  InsertWorkflowTemplate,
  InsertWorkflowStep,
  Order,
  Reminder,
  WorkflowStep,
  WorkflowTemplate,
  NotificationTemplate,
  TeamInvite,
  AuditLog,
  InsertNotificationTemplate,
  InsertReminder,
  BusinessWorkflow,
  NotificationLog,
} from "../lib/database.types";

// ── Query key factory ─────────────────────────────────────────────────────────
export const qk = {
  business: () => ["business"] as const,
  customers: (businessId: string) => ["customers", businessId] as const,
  customer: (id: string) => ["customers", id] as const,
  orders: (businessId: string, filters?: Record<string, unknown>) =>
    ["orders", businessId, filters] as const,
  order: (id: string) => ["orders", id] as const,
  trackingEvents: (orderId: string) => ["tracking_events", orderId] as const,
  workflowTemplates: (businessId: string) => ["workflow_templates", businessId] as const,
  workflowTemplate: (id: string) => ["workflow_templates", id] as const,
  workflowSteps: (templateId: string) => ["workflow_steps", templateId] as const,
  activeWorkflow: (businessId: string) => ["business_workflows", businessId] as const,
  notificationTemplates: (businessId: string) =>
    ["notification_templates", businessId] as const,
  notificationLogs: (businessId: string) => ["notification_logs", businessId] as const,
  reminders: (businessId: string) => ["reminders", businessId] as const,
  teamMembers: (businessId: string) => ["team_members", businessId] as const,
  teamInvites: (businessId: string) => ["team_invites", businessId] as const,
  auditLogs: (businessId: string) => ["audit_logs", businessId] as const,
  dashboard: (businessId: string) => ["dashboard", businessId] as const,
  systemPresets: () => ["workflow_presets", "__system__"] as const,
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Some product features (notification templates, reminders, team invites,
 * report export, ad-hoc notification send, hard-delete of customers/orders)
 * have no endpoint in this deployment's API. Rather than crash, read paths
 * return empty results and write paths throw this clear, user-visible error.
 */
function notSupported(feature: string): never {
  throw new Error(`${feature} is not available in this deployment.`);
}

interface ApiCustomer {
  id: string;
  businessId?: string;
  fullName: string;
  email: string;
  phone?: string | null;
  companyName?: string | null;
  address?: string | null;
  notes?: string | null;
  totalOrders?: number;
  createdAt: string;
  updatedAt?: string;
}

function mapCustomer(c: ApiCustomer, businessId?: string): Customer {
  return {
    id: c.id,
    business_id: c.businessId ?? businessId ?? "",
    full_name: c.fullName,
    email: c.email,
    phone: c.phone ?? null,
    company_name: c.companyName ?? null,
    address: c.address ?? null,
    notes: c.notes ?? null,
    total_orders: c.totalOrders ?? 0,
    created_at: c.createdAt,
    updated_at: c.updatedAt ?? c.createdAt,
  };
}

interface ApiOrder {
  id: string;
  businessId?: string;
  customerId?: string;
  workflowTemplateId?: string | null;
  trackingId: string;
  orderReference?: string | null;
  currentStatus: string;
  currentStepPosition?: number;
  description?: string | null;
  estimatedDeliveryDate?: string | null;
  estimatedCompletion?: string | null;
  notes?: string | null;
  isArchived?: boolean;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: ApiCustomer | null;
}

function mapOrder(o: ApiOrder, businessId?: string): Order {
  const estimated = o.estimatedCompletion ?? o.estimatedDeliveryDate ?? null;
  return {
    id: o.id,
    business_id: o.businessId ?? businessId ?? "",
    customer_id: o.customerId ?? o.customer?.id ?? "",
    workflow_template_id: o.workflowTemplateId ?? null,
    tracking_id: o.trackingId,
    order_reference: o.orderReference ?? null,
    current_status: o.currentStatus,
    current_step_position: o.currentStepPosition ?? 0,
    description: o.description ?? null,
    estimated_completion: estimated,
    // The UI reads `estimated_delivery_date`; keep it in sync with the API's
    // `estimatedDeliveryDate` field so dates render correctly.
    estimated_delivery_date: estimated,
    notes: o.notes ?? null,
    is_archived: o.isArchived ?? false,
    created_by: o.createdBy ?? null,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
  } as Order;
}

interface ApiTrackingEvent {
  id: string;
  orderId: string;
  status: string;
  message?: string | null;
  location?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

function mapTrackingEvent(e: ApiTrackingEvent) {
  return {
    id: e.id,
    order_id: e.orderId,
    status: e.status,
    message: e.message ?? null,
    location: e.location ?? null,
    created_by: e.createdBy ?? null,
    notified: false,
    created_at: e.createdAt,
  };
}

interface ApiBusiness {
  id: string;
  name: string;
  slug: string;
  websiteUrl?: string | null;
  supportEmail?: string | null;
  industry?: string | null;
  employeeCount?: string | null;
  location?: string | null;
  phone?: string | null;
  emailGreeting?: string | null;
  emailSignature?: string | null;
  emailFooterNote?: string | null;
  trackingIdPrefix?: string | null;
  allowedOrigins?: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
}

function mapBusiness(b: ApiBusiness): Business {
  return {
    id: b.id,
    name: b.name,
    slug: b.slug,
    business_type: b.industry ?? "",
    phone: b.phone ?? null,
    email: b.supportEmail ?? null,
    address: null,
    logo_url: null,
    website_url: b.websiteUrl ?? null,
    support_email: b.supportEmail ?? null,
    location: b.location ?? null,
    employee_count: b.employeeCount ?? null,
    email_greeting: b.emailGreeting ?? null,
    email_signature: b.emailSignature ?? null,
    email_footer_note: b.emailFooterNote ?? null,
    tracking_id_prefix: b.trackingIdPrefix ?? null,
    notify_on_status_change: true,
    notification_email: true,
    notification_sms: false,
    notification_whatsapp: false,
    onboarding_completed: b.onboardingCompleted,
    onboarding_step: 0,
    plan: "free",
    created_at: b.createdAt,
    updated_at: b.createdAt,
  };
}

interface ApiWorkflowStep {
  id: string;
  templateId: string;
  label: string;
  description?: string | null;
  position: number;
  color?: string | null;
  isTerminal?: boolean;
  autoNotify?: boolean;
  notifyTemplateId?: string | null;
}

function mapWorkflowStep(s: ApiWorkflowStep): WorkflowStep {
  return {
    id: s.id,
    template_id: s.templateId,
    label: s.label,
    description: s.description ?? null,
    position: s.position,
    color: s.color ?? "#000000",
    is_terminal: s.isTerminal ?? false,
    auto_notify: s.autoNotify ?? false,
    notify_template_id: s.notifyTemplateId ?? null,
  };
}

interface ApiWorkflowTemplate {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  businessType?: string | null;
  isSystem?: boolean;
  createdAt: string;
  steps?: ApiWorkflowStep[];
}

function mapWorkflowTemplate(
  t: ApiWorkflowTemplate,
): WorkflowTemplate & { workflow_steps: WorkflowStep[] } {
  return {
    id: t.id,
    business_id: t.businessId,
    name: t.name,
    description: t.description ?? null,
    business_type: t.businessType ?? null,
    is_system: t.isSystem ?? false,
    created_at: t.createdAt,
    updated_at: t.createdAt,
    workflow_steps: (t.steps ?? []).map(mapWorkflowStep),
  };
}

interface ApiBusinessWorkflow {
  id: string;
  businessId: string;
  templateId: string;
  templateName: string;
  assignedAt: string;
}

function mapBusinessWorkflow(w: ApiBusinessWorkflow): BusinessWorkflow {
  return {
    id: w.id,
    business_id: w.businessId,
    template_id: w.templateId,
    template_name: w.templateName,
    assigned_at: w.assignedAt,
  };
}

interface ApiAuditLog {
  id: string;
  businessId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: unknown;
  createdAt: string;
}

function mapAuditLog(l: ApiAuditLog): AuditLog {
  return {
    id: l.id,
    business_id: l.businessId,
    user_id: l.userId ?? null,
    action: l.action,
    entity_type: l.entityType,
    entity_id: l.entityId ?? null,
    old_value: null,
    new_value: null,
    metadata: (l.metadata ?? null) as AuditLog["metadata"],
    ip_address: null,
    user_agent: null,
    created_at: l.createdAt,
  };
}

interface ApiEmailNotification {
  id: string;
  orderId: string;
  customerEmail: string;
  subject: string;
  body?: string;
  status: string;
  providerMessageId?: string | null;
  createdAt: string;
}

function mapNotificationLog(n: ApiEmailNotification): NotificationLog {
  return {
    id: n.id,
    order_id: n.orderId,
    business_id: "",
    customer_id: null,
    template_id: null,
    channel: "email",
    recipient: n.customerEmail,
    subject: n.subject ?? null,
    body: n.body ?? "",
    status: (n.status as NotificationLog["status"]) ?? "sent",
    provider_message_id: n.providerMessageId ?? null,
    error_message: null,
    sent_at: n.createdAt,
    created_at: n.createdAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS
// ─────────────────────────────────────────────────────────────────────────────

export function useBusiness(businessId: string | null | undefined) {
  return useQuery({
    queryKey: qk.business(),
    enabled: !!businessId,
    queryFn: async () => {
      const data = await apiFetch<ApiBusiness>("/api/business");
      return mapBusiness(data);
    },
  });
}

export function useUpdateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id: _id,
      ...updates
    }: Partial<Business> & { id: string }) => {
      const body: Record<string, unknown> = {};
      if (updates.name !== undefined) body.name = updates.name;
      if (updates.business_type !== undefined) body.industry = updates.business_type;
      if (updates.employee_count !== undefined) body.employeeCount = updates.employee_count;
      if (updates.location !== undefined) body.location = updates.location;
      if (updates.phone !== undefined) body.phone = updates.phone;
      if (updates.website_url !== undefined) body.websiteUrl = updates.website_url;
      if (updates.support_email !== undefined) body.supportEmail = updates.support_email;
      if (updates.email_greeting !== undefined) body.emailGreeting = updates.email_greeting;
      if (updates.email_signature !== undefined) body.emailSignature = updates.email_signature;
      if (updates.email_footer_note !== undefined) body.emailFooterNote = updates.email_footer_note;
      if (updates.tracking_id_prefix !== undefined) body.trackingIdPrefix = updates.tracking_id_prefix;
      if (updates.onboarding_completed !== undefined) body.onboardingCompleted = updates.onboarding_completed;

      const data = await apiFetch<ApiBusiness>("/api/business", {
        method: "PUT",
        body,
      });
      return mapBusiness(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.business() });
    },
  });
}

export function useDeleteBusiness() {
  return useMutation({
    mutationFn: async (_businessId: string) => {
      await apiFetch("/api/business", { method: "DELETE" });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────────────────────────────────────────

export function useCustomers(
  businessId: string | null | undefined,
  opts?: { search?: string; limit?: number; page?: number },
) {
  return useQuery({
    queryKey: qk.customers(businessId ?? ""),
    enabled: !!businessId,
    queryFn: async () => {
      const res = await apiFetch<{ data: ApiCustomer[]; total: number }>("/api/customers", {
        query: {
          search: opts?.search,
          limit: opts?.limit,
          page: opts?.page,
        },
      });
      return {
        customers: (res.data ?? []).map((c) => mapCustomer(c, businessId ?? undefined)),
        total: res.total ?? 0,
      };
    },
  });
}

export function useCustomer(id: string | null | undefined) {
  return useQuery({
    queryKey: ["customer", id ?? ""],
    enabled: !!id,
    queryFn: async () => {
      const data = await apiFetch<ApiCustomer>(`/api/customers/${id}`);
      return mapCustomer(data);
    },
  });
}

export function useCustomerOrders(customerId: string | null | undefined) {
  return useQuery({
    queryKey: ["customerOrders", customerId ?? ""],
    enabled: !!customerId,
    queryFn: async () => {
      const data = await apiFetch<ApiOrder[]>(`/api/customers/${customerId}/orders`);
      return (data ?? []).map((o) => ({
        ...mapOrder(o),
        customers: o.customer
          ? { full_name: o.customer.fullName }
          : null,
      })) as (Order & { customers: { full_name: string } | null })[];
    },
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InsertCustomer) => {
      const data = await apiFetch<ApiCustomer>("/api/customers", {
        method: "POST",
        body: {
          fullName: input.full_name,
          email: input.email,
          phone: input.phone ?? undefined,
          companyName: input.company_name ?? undefined,
          address: input.address ?? undefined,
        },
      });
      return mapCustomer(data);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.customers(variables.business_id) });
    },
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      business_id: _business_id,
      ...updates
    }: Partial<Customer> & { id: string; business_id: string }) => {
      const body: Record<string, unknown> = {};
      if (updates.full_name !== undefined) body.fullName = updates.full_name;
      if (updates.email !== undefined) body.email = updates.email;
      if (updates.phone !== undefined) body.phone = updates.phone;
      if (updates.company_name !== undefined) body.companyName = updates.company_name;
      if (updates.address !== undefined) body.address = updates.address;

      const data = await apiFetch<ApiCustomer>(`/api/customers/${id}`, {
        method: "PUT",
        body,
      });
      return mapCustomer(data);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.customers(variables.business_id) });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_args: { id: string; business_id: string }) => {
      notSupported("Deleting customers");
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.customers(variables.business_id) });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderFilters {
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function useOrders(
  businessId: string | null | undefined,
  filters: OrderFilters = {},
) {
  return useQuery({
    queryKey: qk.orders(businessId ?? "", filters as Record<string, unknown>),
    enabled: !!businessId,
    queryFn: async () => {
      const res = await apiFetch<{ data: ApiOrder[]; total: number }>("/api/orders", {
        query: {
          status: filters.status,
          search: filters.search,
          page: filters.page,
          limit: filters.limit,
        },
      });
      return {
        orders: (res.data ?? []).map((o) => ({
          ...mapOrder(o, businessId ?? undefined),
          customers: o.customer ? mapCustomer(o.customer, businessId ?? undefined) : null,
        })) as (Order & { customers: Customer | null })[],
        total: res.total ?? 0,
      };
    },
  });
}

interface ApiOrderDetail extends ApiOrder {
  customer?: ApiCustomer | null;
  trackingEvents?: ApiTrackingEvent[];
  emailNotifications?: ApiEmailNotification[];
}

export function useOrder(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.order(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const data = await apiFetch<ApiOrderDetail>(`/api/orders/${id}`);
      return {
        ...mapOrder(data),
        customers: data.customer ? mapCustomer(data.customer) : (null as unknown as Customer),
        tracking_events: (data.trackingEvents ?? []).map(mapTrackingEvent),
      } as Order & { customers: Customer; tracking_events: unknown[] };
    },
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InsertOrder) => {
      const data = await apiFetch<ApiOrder>("/api/orders", {
        method: "POST",
        body: {
          customerId: input.customer_id,
          orderReference: input.order_reference ?? undefined,
          description: input.description ?? undefined,
          estimatedDeliveryDate: input.estimated_completion ?? undefined,
        },
      });
      return mapOrder(data);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.orders(variables.business_id) });
      qc.invalidateQueries({ queryKey: qk.dashboard(variables.business_id) });
    },
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      businessId: _businessId,
      status,
      message,
      location,
      userId: _userId,
    }: {
      orderId: string;
      businessId: string;
      status: string;
      message?: string;
      location?: string;
      userId?: string;
    }) => {
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        body: {
          status,
          message: message ?? undefined,
          location: location ?? undefined,
        },
      });
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.order(variables.orderId) });
      qc.invalidateQueries({ queryKey: qk.orders(variables.businessId) });
      qc.invalidateQueries({ queryKey: qk.dashboard(variables.businessId) });
    },
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_args: { id: string; businessId: string }) => {
      notSupported("Deleting orders");
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.orders(variables.businessId) });
      qc.invalidateQueries({ queryKey: qk.dashboard(variables.businessId) });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD STATS
// ─────────────────────────────────────────────────────────────────────────────

export function useDashboardStats(businessId: string | null | undefined) {
  return useQuery({
    queryKey: qk.dashboard(businessId ?? ""),
    enabled: !!businessId,
    queryFn: async () => {
      const [summary, breakdown, customersPage] = await Promise.all([
        apiFetch<{
          totalOrders: number;
          activeDeliveries: number;
          delayedOrders: number;
          deliveredOrders: number;
          cancelledOrders: number;
          emailsSentToday: number;
        }>("/api/dashboard/summary"),
        apiFetch<{ status: string; count: number }[]>("/api/dashboard/status-breakdown"),
        apiFetch<{ total: number }>("/api/customers", { query: { limit: 1 } }),
      ]);

      const statusBreakdown: Record<string, number> = {};
      for (const row of breakdown ?? []) {
        statusBreakdown[row.status] = row.count;
      }

      return {
        ordersLast30Days: summary.totalOrders,
        totalCustomers: customersPage.total ?? 0,
        statusBreakdown,
        totalOrders: summary.totalOrders,
        activeDeliveries: summary.activeDeliveries,
        delayedOrders: summary.delayedOrders,
        deliveredOrders: summary.deliveredOrders,
        emailsSentToday: summary.emailsSentToday,
      };
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export function useWorkflowTemplates(businessId: string | null | undefined) {
  return useQuery({
    queryKey: qk.workflowTemplates(businessId ?? ""),
    enabled: !!businessId,
    queryFn: async () => {
      const data = await apiFetch<ApiWorkflowTemplate[]>("/api/workflow-templates");
      return (data ?? []).map(mapWorkflowTemplate);
    },
  });
}

export function useSystemPresets() {
  return useQuery({
    queryKey: qk.systemPresets(),
    queryFn: async () => {
      // System presets are resolved client-side from a constant; the API does
      // not expose a system-template endpoint.
      return [] as (WorkflowTemplate & { workflow_steps: WorkflowStep[] })[];
    },
  });
}

export function useCreateWorkflowTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      template,
      steps,
    }: {
      template: InsertWorkflowTemplate;
      steps: Omit<InsertWorkflowStep, "template_id">[];
    }) => {
      const data = await apiFetch<ApiWorkflowTemplate>("/api/workflow-templates", {
        method: "POST",
        body: {
          name: template.name,
          description: template.description ?? undefined,
          businessType: template.business_type ?? undefined,
          steps: steps.map((s) => ({
            label: s.label,
            description: s.description ?? undefined,
            position: s.position,
            color: s.color ?? undefined,
            isTerminal: s.is_terminal ?? false,
          })),
        },
      });
      return mapWorkflowTemplate(data);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: qk.workflowTemplates(variables.template.business_id),
      });
    },
  });
}

export function useDeleteWorkflowTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      businessId: _businessId,
    }: { id: string; businessId: string }) => {
      await apiFetch(`/api/workflow-templates/${id}`, { method: "DELETE" });
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.workflowTemplates(variables.businessId) });
    },
  });
}

export function useUpdateWorkflowTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      businessId: _businessId,
      ...updates
    }: Partial<WorkflowTemplate> & { id: string; businessId: string }) => {
      const body: Record<string, unknown> = {};
      if (updates.name !== undefined) body.name = updates.name;
      if (updates.description !== undefined) body.description = updates.description;
      if (updates.business_type !== undefined) body.businessType = updates.business_type;

      const data = await apiFetch<ApiWorkflowTemplate>(`/api/workflow-templates/${id}`, {
        method: "PUT",
        body,
      });
      return mapWorkflowTemplate(data);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.workflowTemplates(variables.businessId) });
    },
  });
}

export function useUpdateWorkflowSteps() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      templateId,
      businessId: _businessId,
      steps,
    }: {
      templateId: string;
      businessId: string;
      steps: Omit<InsertWorkflowStep, "template_id">[];
    }) => {
      await apiFetch(`/api/workflow-templates/${templateId}/steps`, {
        method: "PUT",
        body: {
          steps: steps.map((s) => ({
            label: s.label,
            description: s.description ?? undefined,
            position: s.position,
            color: s.color ?? undefined,
            isTerminal: s.is_terminal ?? false,
          })),
        },
      });
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.workflowTemplates(variables.businessId) });
    },
  });
}

export function useCloneWorkflowTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sourceId,
      businessId: _businessId,
      name,
      presetSteps,
      description,
      businessType,
    }: {
      sourceId?: string;
      businessId: string;
      name: string;
      presetSteps?: Array<{ label: string; description?: string | null; color?: string | null; is_terminal: boolean; position: number }>;
      description?: string | null;
      businessType?: string | null;
    }) => {
      let stepsToInsert: Array<{ label: string; description?: string | null; color?: string | null; is_terminal: boolean; position: number }>;
      let sourceDescription: string | null = description ?? null;
      let sourceBusinessType: string | null = businessType ?? null;

      if (presetSteps) {
        stepsToInsert = presetSteps;
      } else if (sourceId) {
        const source = await apiFetch<ApiWorkflowTemplate>(`/api/workflow-templates/${sourceId}`);
        sourceDescription = source.description ?? null;
        sourceBusinessType = source.businessType ?? null;
        stepsToInsert = (source.steps ?? []).map((s) => ({
          label: s.label,
          description: s.description ?? null,
          color: s.color ?? null,
          is_terminal: s.isTerminal ?? false,
          position: s.position,
        }));
      } else {
        stepsToInsert = [];
      }

      const data = await apiFetch<ApiWorkflowTemplate>("/api/workflow-templates/clone", {
        method: "POST",
        body: {
          name,
          description: sourceDescription ?? undefined,
          businessType: sourceBusinessType ?? undefined,
          steps: stepsToInsert.map((s) => ({
            label: s.label,
            description: s.description ?? undefined,
            position: s.position,
            color: s.color ?? undefined,
            isTerminal: s.is_terminal,
          })),
        },
      });
      return mapWorkflowTemplate(data);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.workflowTemplates(variables.businessId) });
    },
  });
}

export function useActiveWorkflow(businessId: string | null | undefined) {
  return useQuery({
    queryKey: qk.activeWorkflow(businessId ?? ""),
    enabled: !!businessId,
    queryFn: async () => {
      try {
        const data = await apiFetch<ApiBusinessWorkflow>("/api/business-workflows/active");
        return mapBusinessWorkflow(data);
      } catch (e) {
        // 404 = no active workflow assigned yet.
        if (e instanceof Error && /not found|no active/i.test(e.message)) return null;
        const status = (e as { status?: number }).status;
        if (status === 404) return null;
        throw e;
      }
    },
  });
}

export function useActivateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      businessId: _businessId,
      templateId,
      templateName,
    }: {
      businessId: string;
      templateId: string;
      templateName: string;
    }) => {
      await apiFetch("/api/business-workflows/activate", {
        method: "POST",
        body: { templateId, templateName },
      });
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.activeWorkflow(variables.businessId) });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION TEMPLATES (no API endpoint in this deployment)
// ─────────────────────────────────────────────────────────────────────────────

export function useNotificationTemplates(businessId: string | null | undefined) {
  return useQuery({
    queryKey: qk.notificationTemplates(businessId ?? ""),
    enabled: !!businessId,
    queryFn: async () => {
      return [] as NotificationTemplate[];
    },
  });
}

export function useCreateNotificationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_input: InsertNotificationTemplate) => {
      notSupported("Notification templates");
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: qk.notificationTemplates(variables.business_id),
      });
    },
  });
}

export function useUpdateNotificationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      _args: Partial<NotificationTemplate> & { id: string; business_id: string },
    ) => {
      notSupported("Notification templates");
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: qk.notificationTemplates(variables.business_id),
      });
    },
  });
}

export function useDeleteNotificationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_args: { id: string; businessId: string }) => {
      notSupported("Notification templates");
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: qk.notificationTemplates(variables.businessId),
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// REMINDERS (no API endpoint in this deployment)
// ─────────────────────────────────────────────────────────────────────────────

export function useReminders(businessId: string | null | undefined) {
  return useQuery({
    queryKey: qk.reminders(businessId ?? ""),
    enabled: !!businessId,
    queryFn: async () => {
      return [] as Reminder[];
    },
  });
}

export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_input: InsertReminder) => {
      notSupported("Reminders");
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.reminders(variables.business_id) });
    },
  });
}

export function useCancelReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_args: { id: string; businessId: string }) => {
      notSupported("Reminders");
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.reminders(variables.businessId) });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAM MANAGEMENT (only the current user is available via /auth/me)
// ─────────────────────────────────────────────────────────────────────────────

export function useTeamMembers(businessId: string | null | undefined) {
  return useQuery({
    queryKey: qk.teamMembers(businessId ?? ""),
    enabled: !!businessId,
    queryFn: async () => {
      return [] as unknown[];
    },
  });
}

export function useTeamInvites(businessId: string | null | undefined) {
  return useQuery({
    queryKey: qk.teamInvites(businessId ?? ""),
    enabled: !!businessId,
    queryFn: async () => {
      return [] as TeamInvite[];
    },
  });
}

export function useInviteTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_args: { email: string; role: string; businessId: string }) => {
      notSupported("Inviting team members");
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.teamInvites(variables.businessId) });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────────────────────

export function useAuditLogs(
  businessId: string | null | undefined,
  opts?: { limit?: number; page?: number },
) {
  return useQuery({
    queryKey: qk.auditLogs(businessId ?? ""),
    enabled: !!businessId,
    queryFn: async () => {
      const res = await apiFetch<{ data: ApiAuditLog[]; total: number }>("/api/audit-logs", {
        query: {
          limit: opts?.limit,
          page: opts?.page,
        },
      });
      return { logs: (res.data ?? []).map(mapAuditLog), total: res.total ?? 0 };
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION LOGS (email notifications for an order)
// ─────────────────────────────────────────────────────────────────────────────

export function useNotificationLogs(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ["notification_logs", orderId ?? ""],
    enabled: !!orderId,
    queryFn: async () => {
      const data = await apiFetch<ApiEmailNotification[]>(
        `/api/orders/${orderId}/email-notifications`,
      );
      return (data ?? []).map(mapNotificationLog);
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS (resend the latest status email for an order)
// ─────────────────────────────────────────────────────────────────────────────

export function useSendNotification() {
  return useMutation({
    mutationFn: async ({
      orderId,
      channel = "email",
      customMessage: _customMessage,
      customSubject: _customSubject,
    }: {
      orderId: string;
      channel?: string;
      customMessage?: string;
      customSubject?: string;
    }) => {
      if (channel !== "email") {
        notSupported(`Sending ${channel} notifications`);
      }
      const res = await apiFetch<{ success: boolean; emailNotificationId?: string; message: string }>(
        `/api/orders/${orderId}/resend-email`,
        { method: "POST" },
      );
      return {
        success: res.success,
        provider_message_id: res.emailNotificationId,
      } as { success: boolean; provider_message_id?: string };
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT REPORT (no API endpoint in this deployment)
// ─────────────────────────────────────────────────────────────────────────────

export function useExportReport() {
  return useMutation({
    mutationFn: async (_opts: {
      format?: "csv";
      from?: string;
      to?: string;
      status?: string;
    }) => {
      notSupported("Report export");
      return new Blob();
    },
  });
}
