import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessesTable = pgTable("businesses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  websiteUrl: text("website_url").notNull(),
  supportEmail: text("support_email").notNull(),
  industry: text("industry"),
  employeeCount: text("employee_count"),
  location: text("location"),
  phone: text("phone"),
  // Customer email customization. All nullable; the email template applies
  // sensible defaults when these are blank so existing businesses keep
  // working unchanged.
  //   emailGreeting    - opening line, supports {name} placeholder.
  //   emailSignature   - sign-off block; multi-line, supports {businessName}.
  //   emailFooterNote  - free text shown above the support email in footer.
  emailGreeting: text("email_greeting"),
  emailSignature: text("email_signature"),
  emailFooterNote: text("email_footer_note"),
  // Customer-facing tracking ID prefix (3–5 A–Z), unique across all
  // businesses. Used when generating per-business tracking IDs in the form
  // {PREFIX}-{3 alnums}-{4 alnums}. Nullable so existing businesses don't
  // break on migration - order creation falls back to "OLY" until set.
  trackingIdPrefix: text("tracking_id_prefix").unique(),
  // Comma-separated list of website origins allowed to call this business's
  // public endpoints (currently /api/public/track/:id) cross-origin. Lets each
  // tenant whitelist their own customer site without redeploying the API.
  allowedOrigins: text("allowed_origins"),
  // Maximum number of customer status-update emails this business may send per
  // calendar month. Once reached, the API stops sending and surfaces an
  // "upgrade" prompt. Raising this value (manually) is how a business is
  // "upgraded". Default keeps total volume across tenants inside the email
  // provider's free tier.
  monthlyEmailLimit: integer("monthly_email_limit").notNull().default(500),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),

  // ─── Plan & subscription (launch-prep) ────────────────────────────────────
  // Every existing business defaults to the BETA plan/status. Limits are NOT
  // enforced while plan === "beta" or featureFlags.planEnforcement === false.
  plan: text("plan", { enum: ["beta", "free", "pro", "business"] })
    .notNull()
    .default("beta"),
  subscriptionStatus: text("subscription_status", {
    enum: ["beta", "trial", "active", "past_due", "cancelled"],
  })
    .notNull()
    .default("beta"),
  trialStartsAt: timestamp("trial_starts_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  // Paystack linkage. Populated only after a verified payment; never trusted
  // from the frontend.
  billingCustomerCode: text("billing_customer_code"),
  billingSubscriptionCode: text("billing_subscription_code"),
  billingEmailToken: text("billing_email_token"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),

  // ─── Monthly usage counters (enforcement disabled during BETA) ────────────
  emailNotificationsUsed: integer("email_notifications_used").notNull().default(0),
  smsNotificationsUsed: integer("sms_notifications_used").notNull().default(0),
  usagePeriodStart: timestamp("usage_period_start"),
  usagePeriodEnd: timestamp("usage_period_end"),

  // ─── Business branding (applied only when featureFlags.businessBranding) ──
  businessLogoUrl: text("business_logo_url"),
  emailSenderName: text("email_sender_name"),
  primaryBrandColour: text("primary_brand_colour"),
  removeOlyxeeBranding: boolean("remove_olyxee_branding").notNull().default(false),

  // ─── Automated call centre (Retell) — disabled foundation ─────────────────
  callCentreEnabled: boolean("call_centre_enabled").notNull().default(false),
  retellAgentId: text("retell_agent_id"),
  retellPhoneNumber: text("retell_phone_number"),
  retellKnowledgeBaseId: text("retell_knowledge_base_id"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBusinessSchema = createInsertSchema(businessesTable);
export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businessesTable.$inferSelect;
