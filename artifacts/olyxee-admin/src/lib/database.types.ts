/**
 * Database types for Supabase.
 *
 * When the schema is finalised you can regenerate this file with:
 *   npx supabase gen types typescript --linked > src/lib/database.types.ts
 *
 * Until then this manually-authored file reflects the migration schema
 * exactly so the rest of the codebase can import typed helpers.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string;
          name: string;
          slug: string;
          business_type: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          logo_url: string | null;
          website_url: string | null;
          support_email: string | null;
          location: string | null;
          employee_count: string | null;
          email_greeting: string | null;
          email_signature: string | null;
          email_footer_note: string | null;
          tracking_id_prefix: string | null;
          notify_on_status_change: boolean;
          notification_email: boolean;
          notification_sms: boolean;
          notification_whatsapp: boolean;
          onboarding_completed: boolean;
          onboarding_step: number;
          plan: string;
          subscription_status: string;
          trial_starts_at: string | null;
          trial_ends_at: string | null;
          current_period_end: string | null;
          email_notifications_used: number;
          sms_notifications_used: number;
          ai_call_minutes_used: number;
          business_logo_url: string | null;
          invoice_legal_name: string | null;
          invoice_registration_number: string | null;
          invoice_tax_number: string | null;
          invoice_address: string | null;
          invoice_email: string | null;
          invoice_phone: string | null;
          invoice_logo_url: string | null;
          invoice_payment_details: string | null;
          invoice_payment_terms: string | null;
          invoice_footer_note: string | null;
          email_sender_name: string | null;
          primary_brand_colour: string | null;
          remove_olyxee_branding: boolean;
          call_centre_enabled: boolean;
          retell_agent_id: string | null;
          retell_phone_number: string | null;
          retell_knowledge_base_id: string | null;
          monthly_email_limit: number;
          email_usage_this_month: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          business_type?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          logo_url?: string | null;
          website_url?: string | null;
          support_email?: string | null;
          location?: string | null;
          employee_count?: string | null;
          email_greeting?: string | null;
          email_signature?: string | null;
          email_footer_note?: string | null;
          tracking_id_prefix?: string | null;
          notify_on_status_change?: boolean;
          notification_email?: boolean;
          notification_sms?: boolean;
          notification_whatsapp?: boolean;
          onboarding_completed?: boolean;
          onboarding_step?: number;
          plan?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["businesses"]["Insert"]>;
      };

      profiles: {
        Row: {
          id: string;
          business_id: string | null;
          full_name: string;
          email: string;
          role: "owner" | "admin" | "manager" | "staff";
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          business_id?: string | null;
          full_name?: string;
          email?: string;
          role?: "owner" | "admin" | "manager" | "staff";
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["profiles"]["Insert"], "id">>;
      };

      customers: {
        Row: {
          id: string;
          business_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          company_name: string | null;
          address: string | null;
          notes: string | null;
          total_orders: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          full_name: string;
          email?: string;
          phone?: string | null;
          company_name?: string | null;
          address?: string | null;
          notes?: string | null;
          total_orders?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
      };

      orders: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          workflow_template_id: string | null;
          tracking_id: string;
          order_reference: string | null;
          current_status: string;
          transport_mode: string | null;
          invoice_id: string | null;
          supplier_tracking_number: string | null;
          supplier_tracking_number_added_at: string | null;
          cargo_type: string | null;
          service_required: string | null;
          origin: string | null;
          destination: string | null;
          weight: string | null;
          dimensions: string | null;
          current_step_position: number;
          description: string | null;
          estimated_completion: string | null;
          estimated_delivery_date: string | null;
          notes: string | null;
          is_archived: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id: string;
          workflow_template_id?: string | null;
          tracking_id?: string;
          order_reference?: string | null;
          current_status?: string;
          transport_mode?: string | null;
          invoice_id?: string | null;
          supplier_tracking_number?: string | null;
          supplier_tracking_number_added_at?: string | null;
          cargo_type?: string | null;
          service_required?: string | null;
          origin?: string | null;
          destination?: string | null;
          weight?: string | null;
          dimensions?: string | null;
          current_step_position?: number;
          description?: string | null;
          estimated_completion?: string | null;
          estimated_delivery_date?: string | null;
          notes?: string | null;
          is_archived?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
      };

      tracking_events: {
        Row: {
          id: string;
          order_id: string;
          status: string;
          message: string | null;
          location: string | null;
          created_by: string | null;
          notified: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          status: string;
          message?: string | null;
          location?: string | null;
          created_by?: string | null;
          notified?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tracking_events"]["Insert"]>;
      };

      workflow_templates: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          description: string | null;
          business_type: string | null;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string | null;
          business_type?: string | null;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workflow_templates"]["Insert"]>;
      };

      workflow_steps: {
        Row: {
          id: string;
          template_id: string;
          label: string;
          description: string | null;
          position: number;
          color: string;
          is_terminal: boolean;
          auto_notify: boolean;
          notify_template_id: string | null;
        };
        Insert: {
          id?: string;
          template_id: string;
          label: string;
          description?: string | null;
          position: number;
          color?: string;
          is_terminal?: boolean;
          auto_notify?: boolean;
          notify_template_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["workflow_steps"]["Insert"]>;
      };

      business_workflows: {
        Row: {
          id: string;
          business_id: string;
          template_id: string;
          template_name: string;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          template_id: string;
          template_name: string;
          assigned_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_workflows"]["Insert"]>;
      };

      notification_templates: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          channel: "email" | "sms" | "whatsapp";
          trigger_status: string | null;
          subject: string | null;
          body: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          channel?: "email" | "sms" | "whatsapp";
          trigger_status?: string | null;
          subject?: string | null;
          body: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notification_templates"]["Insert"]>;
      };

      notification_logs: {
        Row: {
          id: string;
          order_id: string;
          business_id: string;
          customer_id: string | null;
          template_id: string | null;
          channel: string;
          recipient: string;
          subject: string | null;
          body: string;
          status: "pending" | "sent" | "failed" | "delivered";
          provider_message_id: string | null;
          error_message: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          business_id: string;
          customer_id?: string | null;
          template_id?: string | null;
          channel: string;
          recipient: string;
          subject?: string | null;
          body: string;
          status?: "pending" | "sent" | "failed" | "delivered";
          provider_message_id?: string | null;
          error_message?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notification_logs"]["Insert"]>;
      };

      reminders: {
        Row: {
          id: string;
          business_id: string;
          order_id: string;
          customer_id: string;
          channel: string;
          message: string;
          scheduled_at: string;
          sent_at: string | null;
          status: "pending" | "sent" | "cancelled" | "failed";
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          order_id: string;
          customer_id: string;
          channel?: string;
          message: string;
          scheduled_at: string;
          sent_at?: string | null;
          status?: "pending" | "sent" | "cancelled" | "failed";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reminders"]["Insert"]>;
      };

      team_invites: {
        Row: {
          id: string;
          business_id: string;
          email: string;
          role: string;
          token: string;
          invited_by: string | null;
          accepted_at: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          email: string;
          role?: string;
          token?: string;
          invited_by?: string | null;
          accepted_at?: string | null;
          expires_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_invites"]["Insert"]>;
      };

      audit_logs: {
        Row: {
          id: string;
          business_id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_value: Json | null;
          new_value: Json | null;
          metadata: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          old_value?: Json | null;
          new_value?: Json | null;
          metadata?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
      };
      call_records: {
        Row: {
          id: string;
          business_id: string;
          retell_call_id: string | null;
          from_number: string | null;
          order_id: string | null;
          status: "received" | "in_progress" | "completed" | "escalated" | "failed";
          transcript: string | null;
          summary: string | null;
          escalated: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          retell_call_id?: string | null;
          from_number?: string | null;
          order_id?: string | null;
          status?: "received" | "in_progress" | "completed" | "escalated" | "failed";
          transcript?: string | null;
          summary?: string | null;
          escalated?: boolean;
          created_at?: string;
        };
      };
      call_usage: {
        Row: {
          id: string;
          business_id: string;
          call_id: string;
          minutes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          call_id: string;
          minutes?: number;
          created_at?: string;
        };
      };
    };

    Views: Record<string, never>;

    Functions: {
      get_my_business_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      get_my_role: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      generate_tracking_id: {
        Args: { p_business_id: string };
        Returns: string;
      };
    };

    Enums: {
      user_role: "owner" | "admin" | "manager" | "staff";
      notification_channel: "email" | "sms" | "whatsapp";
      notification_status: "pending" | "sent" | "failed" | "delivered";
      reminder_status: "pending" | "sent" | "cancelled" | "failed";
    };
  };
}

// Convenience row types
export type Business = Database["public"]["Tables"]["businesses"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type TrackingEvent = Database["public"]["Tables"]["tracking_events"]["Row"];
export type WorkflowTemplate = Database["public"]["Tables"]["workflow_templates"]["Row"];
export type WorkflowStep = Database["public"]["Tables"]["workflow_steps"]["Row"];
export type BusinessWorkflow = Database["public"]["Tables"]["business_workflows"]["Row"];
export type NotificationTemplate = Database["public"]["Tables"]["notification_templates"]["Row"];
export type NotificationLog = Database["public"]["Tables"]["notification_logs"]["Row"];
export type Reminder = Database["public"]["Tables"]["reminders"]["Row"];
export type TeamInvite = Database["public"]["Tables"]["team_invites"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
export type CallRecord = Database["public"]["Tables"]["call_records"]["Row"];
export type CallUsage = Database["public"]["Tables"]["call_usage"]["Row"];

// Convenience insert types
export type InsertBusiness = Database["public"]["Tables"]["businesses"]["Insert"];
export type InsertCustomer = Database["public"]["Tables"]["customers"]["Insert"];
export type InsertOrder = Database["public"]["Tables"]["orders"]["Insert"];
export type InsertTrackingEvent = Database["public"]["Tables"]["tracking_events"]["Insert"];
export type InsertWorkflowTemplate = Database["public"]["Tables"]["workflow_templates"]["Insert"];
export type InsertWorkflowStep = Database["public"]["Tables"]["workflow_steps"]["Insert"];
export type InsertNotificationTemplate = Database["public"]["Tables"]["notification_templates"]["Insert"];
export type InsertReminder = Database["public"]["Tables"]["reminders"]["Insert"];
export type InsertCallRecord = Database["public"]["Tables"]["call_records"]["Insert"];
export type InsertCallUsage = Database["public"]["Tables"]["call_usage"]["Insert"];
