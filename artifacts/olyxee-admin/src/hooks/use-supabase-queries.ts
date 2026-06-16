/**
 * Supabase query hooks
 *
 * All data fetching hooks for the app live here.
 * They use TanStack Query (useQuery / useMutation) with the Supabase JS client.
 *
 * Pattern:
 *   useXxx()        → read (useQuery)
 *   useCreateXxx()  → insert (useMutation)
 *   useUpdateXxx()  → update (useMutation)
 *   useDeleteXxx()  → delete (useMutation)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
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

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS
// ─────────────────────────────────────────────────────────────────────────────

export function useBusiness(businessId: string | null | undefined) {
  return useQuery({
    queryKey: qk.business(),
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", businessId!)
        .single();
      if (error) throw error;
      return data as Business;
    },
  });
}

export function useUpdateBusiness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Business> & { id: string }) => {
      const { data, error } = await supabase
        .from("businesses")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Business;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.business() });
    },
  });
}

export function useDeleteBusiness() {
  return useMutation({
    mutationFn: async (businessId: string) => {
      const { error } = await supabase
        .from("businesses")
        .delete()
        .eq("id", businessId);
      if (error) throw error;
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
      let query = supabase
        .from("customers")
        .select("*", { count: "exact" })
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });

      if (opts?.search) {
        query = query.or(
          `full_name.ilike.%${opts.search}%,email.ilike.%${opts.search}%,phone.ilike.%${opts.search}%`,
        );
      }
      if (opts?.limit) {
        const offset = ((opts.page ?? 1) - 1) * opts.limit;
        query = query.range(offset, offset + opts.limit - 1);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { customers: (data ?? []) as Customer[], total: count ?? 0 };
    },
  });
}

export function useCustomer(id: string | null | undefined) {
  return useQuery({
    queryKey: ["customer", id ?? ""],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Customer;
    },
  });
}

export function useCustomerOrders(customerId: string | null | undefined) {
  return useQuery({
    queryKey: ["customerOrders", customerId ?? ""],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customers ( full_name )")
        .eq("customer_id", customerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (Order & { customers: { full_name: string } | null })[];
    },
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InsertCustomer) => {
      const { data, error } = await supabase
        .from("customers")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as Customer;
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
      business_id,
      ...updates
    }: Partial<Customer> & { id: string; business_id: string }) => {
      const { data, error } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", id)
        .eq("business_id", business_id)
        .select()
        .single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.customers(variables.business_id) });
    },
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      business_id,
    }: { id: string; business_id: string }) => {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id)
        .eq("business_id", business_id);
      if (error) throw error;
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
    queryKey: qk.orders(businessId ?? "", filters),
    enabled: !!businessId,
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(
          `*, customers ( full_name, email, phone, company_name )`,
          { count: "exact" },
        )
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });

      if (filters.status) query = query.eq("current_status", filters.status);
      if (filters.from) query = query.gte("created_at", filters.from);
      if (filters.to) query = query.lte("created_at", filters.to);
      if (filters.search) {
        query = query.or(
          `tracking_id.ilike.%${filters.search}%,order_reference.ilike.%${filters.search}%`,
        );
      }
      if (filters.limit) {
        const offset = ((filters.page ?? 1) - 1) * filters.limit;
        query = query.range(offset, offset + filters.limit - 1);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { orders: (data ?? []) as (Order & { customers: Customer | null })[], total: count ?? 0 };
    },
  });
}

export function useOrder(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.order(id ?? ""),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `*, customers ( * ), tracking_events ( * )`,
        )
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Order & { customers: Customer; tracking_events: unknown[] };
    },
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InsertOrder) => {
      const { data, error } = await supabase
        .from("orders")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as Order;
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
      businessId,
      status,
      message,
      location,
      userId,
    }: {
      orderId: string;
      businessId: string;
      status: string;
      message?: string;
      location?: string;
      userId?: string;
    }) => {
      // Update the order
      const { error: orderError } = await supabase
        .from("orders")
        .update({ current_status: status })
        .eq("id", orderId)
        .eq("business_id", businessId);
      if (orderError) throw orderError;

      // Append tracking event
      const { error: eventError } = await supabase
        .from("tracking_events")
        .insert({
          order_id: orderId,
          status,
          message: message ?? null,
          location: location ?? null,
          created_by: userId ?? null,
        });
      if (eventError) throw eventError;
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
    mutationFn: async ({
      id,
      businessId,
    }: { id: string; businessId: string }) => {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", id)
        .eq("business_id", businessId);
      if (error) throw error;
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
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [ordersRes, customersRes, statusRes, totalOrdersRes, emailsTodayRes] = await Promise.all([
        // Orders last 30 days
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId!)
          .gte("created_at", thirtyDaysAgo),
        // Total customers
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId!),
        // Status breakdown (all orders)
        supabase
          .from("orders")
          .select("current_status")
          .eq("business_id", businessId!),
        // Total orders ever
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId!),
        // Emails sent today
        supabase
          .from("notification_logs")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId!)
          .gte("sent_at", todayStart.toISOString()),
      ]);

      const statusBreakdown: Record<string, number> = {};
      for (const row of statusRes.data ?? []) {
        statusBreakdown[row.current_status] = (statusBreakdown[row.current_status] ?? 0) + 1;
      }

      return {
        ordersLast30Days: ordersRes.count ?? 0,
        totalCustomers: customersRes.count ?? 0,
        statusBreakdown,
        totalOrders: totalOrdersRes.count ?? 0,
        activeDeliveries: (statusBreakdown["In transit"] ?? 0) + (statusBreakdown["Out for delivery"] ?? 0),
        delayedOrders: statusBreakdown["Delayed"] ?? 0,
        deliveredOrders: statusBreakdown["Delivered"] ?? 0,
        emailsSentToday: emailsTodayRes.count ?? 0,
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
      const { data, error } = await supabase
        .from("workflow_templates")
        .select("*, workflow_steps(*)")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (WorkflowTemplate & { workflow_steps: WorkflowStep[] })[];
    },
  });
}

export function useSystemPresets() {
  return useQuery({
    queryKey: qk.systemPresets(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_templates")
        .select("*, workflow_steps(*)")
        .eq("business_id", "__system__")
        .eq("is_system", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as (WorkflowTemplate & { workflow_steps: WorkflowStep[] })[];
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
      const { data: tmpl, error: tmplError } = await supabase
        .from("workflow_templates")
        .insert(template)
        .select()
        .single();
      if (tmplError) throw tmplError;

      if (steps.length > 0) {
        const { error: stepsError } = await supabase
          .from("workflow_steps")
          .insert(steps.map((s) => ({ ...s, template_id: (tmpl as WorkflowTemplate).id })));
        if (stepsError) throw stepsError;
      }
      return tmpl as WorkflowTemplate;
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
      businessId,
    }: { id: string; businessId: string }) => {
      const { error } = await supabase
        .from("workflow_templates")
        .delete()
        .eq("id", id)
        .eq("business_id", businessId);
      if (error) throw error;
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
      businessId,
      ...updates
    }: Partial<WorkflowTemplate> & { id: string; businessId: string }) => {
      const { data, error } = await supabase
        .from("workflow_templates")
        .update(updates)
        .eq("id", id)
        .eq("business_id", businessId)
        .select()
        .single();
      if (error) throw error;
      return data as WorkflowTemplate;
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
      businessId,
      steps,
    }: {
      templateId: string;
      businessId: string;
      steps: Omit<InsertWorkflowStep, "template_id">[];
    }) => {
      // Delete all existing steps then re-insert
      const { error: delError } = await supabase
        .from("workflow_steps")
        .delete()
        .eq("template_id", templateId);
      if (delError) throw delError;

      if (steps.length > 0) {
        const { error: insError } = await supabase
          .from("workflow_steps")
          .insert(steps.map((s) => ({ ...s, template_id: templateId })));
        if (insError) throw insError;
      }
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
      businessId,
      name,
    }: { sourceId: string; businessId: string; name: string }) => {
      // Fetch source template + steps
      const { data: source, error: fetchError } = await supabase
        .from("workflow_templates")
        .select("*, workflow_steps(*)")
        .eq("id", sourceId)
        .single();
      if (fetchError) throw fetchError;

      // Insert new template
      const { data: newTmpl, error: tmplError } = await supabase
        .from("workflow_templates")
        .insert({ business_id: businessId, name, description: (source as any).description, business_type: (source as any).business_type, is_system: false })
        .select()
        .single();
      if (tmplError) throw tmplError;

      const sourceSteps = (source as any).workflow_steps ?? [];
      if (sourceSteps.length > 0) {
        const { error: stepsError } = await supabase
          .from("workflow_steps")
          .insert(sourceSteps.map((s: any) => ({
            template_id: (newTmpl as WorkflowTemplate).id,
            label: s.label,
            description: s.description,
            color: s.color,
            is_terminal: s.is_terminal,
            position: s.position,
          })));
        if (stepsError) throw stepsError;
      }
      return newTmpl as WorkflowTemplate;
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
      const { data, error } = await supabase
        .from("business_workflows")
        .select("*, workflow_templates(*, workflow_steps(*))")
        .eq("business_id", businessId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useActivateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      businessId,
      templateId,
      templateName,
    }: {
      businessId: string;
      templateId: string;
      templateName: string;
    }) => {
      // Upsert (business only has one active workflow)
      const { error } = await supabase
        .from("business_workflows")
        .upsert(
          { business_id: businessId, template_id: templateId, template_name: templateName },
          { onConflict: "business_id" },
        );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.activeWorkflow(variables.businessId) });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export function useNotificationTemplates(businessId: string | null | undefined) {
  return useQuery({
    queryKey: qk.notificationTemplates(businessId ?? ""),
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_templates")
        .select("*")
        .eq("business_id", businessId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as NotificationTemplate[];
    },
  });
}

export function useCreateNotificationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InsertNotificationTemplate) => {
      const { data, error } = await supabase
        .from("notification_templates")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as NotificationTemplate;
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
    mutationFn: async ({
      id,
      business_id,
      ...updates
    }: Partial<NotificationTemplate> & { id: string; business_id: string }) => {
      const { data, error } = await supabase
        .from("notification_templates")
        .update(updates)
        .eq("id", id)
        .eq("business_id", business_id)
        .select()
        .single();
      if (error) throw error;
      return data as NotificationTemplate;
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
    mutationFn: async ({
      id,
      businessId,
    }: { id: string; businessId: string }) => {
      const { error } = await supabase
        .from("notification_templates")
        .delete()
        .eq("id", id)
        .eq("business_id", businessId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: qk.notificationTemplates(variables.businessId),
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// REMINDERS
// ─────────────────────────────────────────────────────────────────────────────

export function useReminders(businessId: string | null | undefined) {
  return useQuery({
    queryKey: qk.reminders(businessId ?? ""),
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*, orders(tracking_id, current_status), customers(full_name, email)")
        .eq("business_id", businessId!)
        .order("scheduled_at");
      if (error) throw error;
      return (data ?? []) as Reminder[];
    },
  });
}

export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InsertReminder) => {
      const { data, error } = await supabase
        .from("reminders")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as Reminder;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.reminders(variables.business_id) });
    },
  });
}

export function useCancelReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      businessId,
    }: { id: string; businessId: string }) => {
      const { error } = await supabase
        .from("reminders")
        .update({ status: "cancelled" })
        .eq("id", id)
        .eq("business_id", businessId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.reminders(variables.businessId) });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAM MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export function useTeamMembers(businessId: string | null | undefined) {
  return useQuery({
    queryKey: qk.teamMembers(businessId ?? ""),
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("business_id", businessId!)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTeamInvites(businessId: string | null | undefined) {
  return useQuery({
    queryKey: qk.teamInvites(businessId ?? ""),
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_invites")
        .select("*")
        .eq("business_id", businessId!)
        .is("accepted_at", null)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TeamInvite[];
    },
  });
}

export function useInviteTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      email,
      role,
      businessId,
    }: {
      email: string;
      role: string;
      businessId: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("invite-team-member", {
        body: { email, role, business_id: businessId },
        headers: session
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });
      if (res.error) throw res.error;
      return res.data;
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
      const limit = opts?.limit ?? 50;
      const offset = ((opts?.page ?? 1) - 1) * limit;
      const { data, error, count } = await supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return { logs: (data ?? []) as AuditLog[], total: count ?? 0 };
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION LOGS
// ─────────────────────────────────────────────────────────────────────────────

export function useNotificationLogs(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ["notification_logs", orderId ?? ""],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_logs")
        .select("*")
        .eq("order_id", orderId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS (send via edge function)
// ─────────────────────────────────────────────────────────────────────────────

export function useSendNotification() {
  return useMutation({
    mutationFn: async ({
      orderId,
      channel = "email",
      customMessage,
      customSubject,
    }: {
      orderId: string;
      channel?: string;
      customMessage?: string;
      customSubject?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("send-notification", {
        body: {
          order_id: orderId,
          channel,
          custom_message: customMessage,
          custom_subject: customSubject,
        },
        headers: session
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });
      if (res.error) throw res.error;
      return res.data as { success: boolean; provider_message_id?: string };
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT REPORT
// ─────────────────────────────────────────────────────────────────────────────

export function useExportReport() {
  return useMutation({
    mutationFn: async (opts: {
      format?: "csv";
      from?: string;
      to?: string;
      status?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("export-report", {
        body: opts,
        headers: session
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });
      if (res.error) throw res.error;
      // res.data is already a Blob when content-type is text/csv
      return res.data as Blob;
    },
  });
}
