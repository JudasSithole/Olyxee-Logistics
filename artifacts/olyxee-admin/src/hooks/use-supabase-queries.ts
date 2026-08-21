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
  Order,
  Reminder,
  NotificationTemplate,
  TeamInvite,
  AuditLog,
  InsertNotificationTemplate,
  InsertReminder,
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
  notificationTemplates: (businessId: string) =>
    ["notification_templates", businessId] as const,
  notificationLogs: (businessId: string) => ["notification_logs", businessId] as const,
  reminders: (businessId: string) => ["reminders", businessId] as const,
  teamMembers: (businessId: string) => ["team_members", businessId] as const,
  teamInvites: (businessId: string) => ["team_invites", businessId] as const,
  auditLogs: (businessId: string) => ["audit_logs", businessId] as const,
  dashboard: (businessId: string) => ["dashboard", businessId] as const,
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
  jobNumber?: string | null;
  billingType?: string | null;
  billingStatus?: string | null;
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
  transportMode?: string | null;
  invoiceId?: string | null;
  invoiceStatus?: string | null;
  supplierTrackingNumber?: string | null;
  supplierTrackingNumberAddedAt?: string | null;
  cargoType?: string | null;
  serviceRequired?: string | null;
  origin?: string | null;
  destination?: string | null;
  weight?: string | null;
  dimensions?: string | null;
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
    job_number: o.jobNumber ?? null,
    billing_type: o.billingType ?? "PREPAID",
    billing_status: o.billingStatus ?? "NOT_INVOICED",
    current_status: o.currentStatus,
    transport_mode: o.transportMode ?? null,
    invoice_id: o.invoiceId ?? null,
    supplier_tracking_number: o.supplierTrackingNumber ?? null,
    supplier_tracking_number_added_at: o.supplierTrackingNumberAddedAt ?? null,
    cargo_type: o.cargoType ?? null,
    service_required: o.serviceRequired ?? null,
    origin: o.origin ?? null,
    destination: o.destination ?? null,
    weight: o.weight ?? null,
    dimensions: o.dimensions ?? null,
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
  monthlyEmailLimit?: number;
  emailUsageThisMonth?: number;
  onboardingCompleted: boolean;
  plan?: string;
  subscriptionStatus?: string;
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  emailNotificationsUsed?: number;
  smsNotificationsUsed?: number;
  aiCallMinutesUsed?: number;
  businessLogoUrl?: string | null;
  invoiceLegalName?: string | null; invoiceRegistrationNumber?: string | null; invoiceTaxNumber?: string | null;
  invoiceAddress?: string | null; invoiceEmail?: string | null; invoicePhone?: string | null; invoiceLogoUrl?: string | null;
  invoicePaymentDetails?: string | null; invoicePaymentTerms?: string | null; invoiceFooterNote?: string | null;
  emailSenderName?: string | null;
  primaryBrandColour?: string | null;
  removeOlyxeeBranding?: boolean;
  callCentreEnabled?: boolean;
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
    allowed_origins: b.allowedOrigins ?? null,
    notify_on_status_change: true,
    notification_email: true,
    notification_sms: false,
    notification_whatsapp: false,
    onboarding_completed: b.onboardingCompleted,
    onboarding_step: 0,
    plan: b.plan ?? "beta",
    subscription_status: b.subscriptionStatus ?? "beta",
    trial_starts_at: b.trialStartsAt ?? null,
    trial_ends_at: b.trialEndsAt ?? null,
    current_period_end: b.currentPeriodEnd ?? null,
    email_notifications_used: b.emailNotificationsUsed ?? 0,
    sms_notifications_used: b.smsNotificationsUsed ?? 0,
    ai_call_minutes_used: b.aiCallMinutesUsed ?? 0,
    business_logo_url: b.businessLogoUrl ?? null,
    invoice_legal_name: b.invoiceLegalName ?? null,
    invoice_registration_number: b.invoiceRegistrationNumber ?? null,
    invoice_tax_number: b.invoiceTaxNumber ?? null,
    invoice_address: b.invoiceAddress ?? null,
    invoice_email: b.invoiceEmail ?? null,
    invoice_phone: b.invoicePhone ?? null,
    invoice_logo_url: b.invoiceLogoUrl ?? null,
    invoice_payment_details: b.invoicePaymentDetails ?? null,
    invoice_payment_terms: b.invoicePaymentTerms ?? null,
    invoice_footer_note: b.invoiceFooterNote ?? null,
    email_sender_name: b.emailSenderName ?? null,
    primary_brand_colour: b.primaryBrandColour ?? null,
    remove_olyxee_branding: b.removeOlyxeeBranding ?? false,
    call_centre_enabled: b.callCentreEnabled ?? false,
    retell_agent_id: null,
    retell_phone_number: null,
    retell_knowledge_base_id: null,
    monthly_email_limit: b.monthlyEmailLimit ?? 500,
    email_usage_this_month: b.emailUsageThisMonth ?? 0,
    created_at: b.createdAt,
    updated_at: b.createdAt,
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
      if (updates.allowed_origins !== undefined) body.allowedOrigins = updates.allowed_origins;
      if (updates.business_logo_url !== undefined) body.businessLogoUrl = updates.business_logo_url;
      if (updates.primary_brand_colour !== undefined) body.primaryBrandColour = updates.primary_brand_colour;
      if (updates.invoice_legal_name !== undefined) body.invoiceLegalName = updates.invoice_legal_name;
      if (updates.invoice_registration_number !== undefined) body.invoiceRegistrationNumber = updates.invoice_registration_number;
      if (updates.invoice_tax_number !== undefined) body.invoiceTaxNumber = updates.invoice_tax_number;
      if (updates.invoice_address !== undefined) body.invoiceAddress = updates.invoice_address;
      if (updates.invoice_email !== undefined) body.invoiceEmail = updates.invoice_email;
      if (updates.invoice_phone !== undefined) body.invoicePhone = updates.invoice_phone;
      if (updates.invoice_logo_url !== undefined) body.invoiceLogoUrl = updates.invoice_logo_url;
      if (updates.invoice_payment_details !== undefined) body.invoicePaymentDetails = updates.invoice_payment_details;
      if (updates.invoice_payment_terms !== undefined) body.invoicePaymentTerms = updates.invoice_payment_terms;
      if (updates.invoice_footer_note !== undefined) body.invoiceFooterNote = updates.invoice_footer_note;
      if (updates.onboarding_completed !== undefined) body.onboardingCompleted = updates.onboarding_completed;

      const data = await apiFetch<ApiBusiness>("/api/business", {
        method: "PUT",
        body,
      });
      return mapBusiness(data);
    },
    onSuccess: (business) => {
      qc.setQueryData(qk.business(), business);
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
    // Include the filter options in the key so a search actually refetches
    // instead of serving the cached unfiltered page.
    queryKey: [...qk.customers(businessId ?? ""), opts?.search ?? "", opts?.limit ?? 0, opts?.page ?? 1],
    enabled: !!businessId,
    placeholderData: (prev) => prev,
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
        invoice_status: data.invoiceStatus ?? null,
        customers: data.customer ? mapCustomer(data.customer) : (null as unknown as Customer),
        tracking_events: (data.trackingEvents ?? []).map(mapTrackingEvent),
      } as Order & { invoice_status: string | null; customers: Customer; tracking_events: unknown[] };
    },
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: InsertOrder & {
        job_number: string;
        billing_type: "PREPAID" | "POSTPAID";
        invoice_subtotal?: string;
        invoice_additional_charges?: string;
      },
    ) => {
      const data = await apiFetch<ApiOrder>("/api/orders", {
        method: "POST",
        body: {
          customerId: input.customer_id,
          jobNumber: input.job_number,
          billingType: input.billing_type,
          orderReference: input.order_reference ?? undefined,
          description: input.description ?? undefined,
          estimatedDeliveryDate: input.estimated_completion ?? undefined,
          transportMode: (input as { transport_mode?: string }).transport_mode ?? undefined,
          cargoType: (input as { cargo_type?: string }).cargo_type ?? undefined,
          serviceRequired: (input as { service_required?: string }).service_required ?? undefined,
          origin: (input as { origin?: string }).origin ?? undefined,
          destination: (input as { destination?: string }).destination ?? undefined,
          weight: (input as { weight?: string }).weight ?? undefined,
          dimensions: (input as { dimensions?: string }).dimensions ?? undefined,
          // PREPAID sends the accepted amount; POSTPAID omits it (invoiced later).
          invoiceSubtotal: input.invoice_subtotal || undefined,
          invoiceAdditionalCharges: input.invoice_additional_charges || undefined,
        },
      });
      return { ...mapOrder(data), invoice_email_status: (data as ApiOrder & { invoiceEmailStatus?: string }).invoiceEmailStatus };
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
      return await apiFetch<{
        emailStatus: "sent" | "failed" | "skipped" | "limit_reached";
        emailNotificationId?: string;
        emailUsage?: number;
        emailLimit?: number;
      }>(`/api/orders/${orderId}/status`, {
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
          escalatedCallsToday: number;
          callsToday: number;
          unpaidInvoices: number;
          ordersAwaitingSupplierTracking: number;
          airOrders: number;
          seaOrders: number;
          delayedOrStuckShipments: number;
          paidRevenue: number;
          topProduct: { name: string; orderCount: number } | null;
          productBreakdown: Array<{ name: string; orderCount: number }>;
          cargoProfitBreakdown: Array<{ name: string; revenue: number; cost: number; profit: number; jobCount: number }>;
          revenueByMonth: Array<{ month: string; amount: number }>;
          topRoute: { name: string; orderCount: number } | null;
          topCustomer: { id: string; name: string; companyName: string | null; paidAmount: number } | null;
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
        escalatedCallsToday: summary.escalatedCallsToday,
        callsToday: summary.callsToday,
        unpaidInvoices: summary.unpaidInvoices,
        ordersAwaitingSupplierTracking: summary.ordersAwaitingSupplierTracking,
        airOrders: summary.airOrders,
        seaOrders: summary.seaOrders,
        delayedOrStuckShipments: summary.delayedOrStuckShipments,
        paidRevenue: summary.paidRevenue,
        topProduct: summary.topProduct,
        productBreakdown: summary.productBreakdown,
        cargoProfitBreakdown: summary.cargoProfitBreakdown ?? [],
        revenueByMonth: summary.revenueByMonth,
        topRoute: summary.topRoute,
        topCustomer: summary.topCustomer,
      };
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
      const response = await apiFetch<{ data: Array<{ id: string; name: string; email: string; role: string; avatarUrl: string | null; lastActiveAt: string | null }> }>("/api/team/members");
      return response.data;
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
      const res = await apiFetch<{
        success: boolean;
        emailNotificationId?: string;
        message: string;
        emailStatus?: "sent" | "failed" | "limit_reached";
        emailUsage?: number;
        emailLimit?: number;
      }>(`/api/orders/${orderId}/resend-email`, { method: "POST" });
      return {
        success: res.success,
        provider_message_id: res.emailNotificationId,
        message: res.message,
        emailStatus: res.emailStatus,
        emailUsage: res.emailUsage,
        emailLimit: res.emailLimit,
      };
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

// ─────────────────────────────────────────────────────────────────────────────
// CALL CENTRE
// ─────────────────────────────────────────────────────────────────────────────

export function useCallCentreStatus(businessId: string | null | undefined) {
  return useQuery({
    queryKey: ["call-centre-status"],
    enabled: !!businessId,
    queryFn: async () => {
      const data = await apiFetch<{
        callCentreEnabled: boolean;
        retellAgentId: string | null;
        retellPhoneNumber: string | null;
        retellKnowledgeBaseId: string | null;
        plan: string;
        canEnable: boolean;
      }>("/api/call-centre/status");
      return data;
    },
  });
}

export function useEnableCallCentre() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input?: { countryCode?: string; areaCode?: string }) => {
      const data = await apiFetch<{
        status: string;
        retellAgentId: string;
        retellPhoneNumber: string | null;
        retellKnowledgeBaseId: string | null;
      }>("/api/call-centre/enable", {
        method: "POST",
        body: input ?? {},
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["call-centre-status"] });
    },
  });
}

export function useDisableCallCentre() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const data = await apiFetch<{ status: string }>("/api/call-centre/disable", {
        method: "POST",
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["call-centre-status"] });
    },
  });
}

export function useCalls(businessId: string | null | undefined) {
  return useQuery({
    queryKey: ["calls"],
    enabled: !!businessId,
    queryFn: async () => {
      const data = await apiFetch<any[]>("/api/call-centre/calls");
      return data ?? [];
    },
  });
}

export function useCall(callId: string | null | undefined) {
  return useQuery({
    queryKey: ["call", callId ?? ""],
    enabled: !!callId,
    queryFn: async () => {
      const data = await apiFetch<any>(`/api/call-centre/calls/${callId}`);
      return data;
    },
  });
}

