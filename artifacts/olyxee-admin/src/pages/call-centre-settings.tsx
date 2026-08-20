import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Phone, PhoneOff, Loader2, AlertCircle, CheckCircle2,
  ExternalLink, MessageSquare, ArrowRightCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { plans, isFeatureEnabled } from "@/lib/launch";
import { apiFetch } from "@/lib/api";
import { useState } from "react";

const TINTS = {
  blue: "#0a84ff",
  green: "#34c759",
  red: "#ff3b30",
  gray: "#8e8e93",
} as const;

function SectionShell({
  icon: Icon, title, description, children, tint = TINTS.gray, action,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
  tint?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] shadow-sm ring-1 ring-black/5"
            style={{ backgroundColor: tint }}
          >
            <Icon className="h-[18px] w-[18px] text-white" aria-hidden="true" />
          </span>
          <div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function CallCentreSettingsPage() {
  const { user } = useAuth();
  const featureOn = isFeatureEnabled("automatedCallCentre");

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["call-centre-status"],
    queryFn: async () => {
      const res = await apiFetch<{
        callCentreEnabled: boolean;
        retellAgentId: string | null;
        retellPhoneNumber: string | null;
        retellKnowledgeBaseId: string | null;
        callCentreForwardingNumber: string | null;
        plan: string;
        canEnable: boolean;
      }>("/api/call-centre/status");
      return res;
    },
    enabled: !!user?.businessId,
  });

  const [forwardingNumber, setForwardingNumber] = useState("");

  const enableMutation = useMutation({
    mutationFn: async (input?: { countryCode?: string; areaCode?: string; forwardingNumber?: string }) => {
      const res = await apiFetch<{ status: string; retellAgentId: string; retellPhoneNumber: string | null; retellKnowledgeBaseId: string | null; callCentreForwardingNumber: string | null }>(
        "/api/call-centre/enable",
        { method: "POST", body: input ?? {} },
      );
      return res;
    },
    onSuccess: () => {
      setForwardingNumber("");
      void refetch();
      toast.success("Call centre enabled");
    },
    onError: () => toast.error("Failed to enable call centre"),
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch<{ status: string }>("/api/call-centre/disable", {
        method: "POST",
      });
      return res;
    },
    onSuccess: () => {
      void refetch();
      toast.success("Call centre disabled");
    },
    onError: () => toast.error("Failed to disable call centre"),
  });

  const planId = (status?.plan as "beta" | "free" | "pro" | "business" | undefined) ?? "beta";
  const plan = plans[planId] ?? plans.beta;

  if (!featureOn) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Call Centre</h1>
          <p className="text-muted-foreground text-sm mt-0.5">AI-powered inbound call handling.</p>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            The automated call centre is not yet available. It will launch on 20 August 2026.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const canEnable = status?.canEnable ?? false;
  const enabled = status?.callCentreEnabled ?? false;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Call Centre</h1>
        <p className="text-muted-foreground text-sm mt-0.5">AI-powered inbound call handling by Retell.</p>
      </div>

      <SectionShell
        icon={Phone}
        tint={enabled ? TINTS.green : TINTS.gray}
        title="Connect Call Centre"
        description={enabled ? "Your AI agent is active and handling calls." : "Set up an AI agent to answer inbound customer calls."}
        action={
          enabled ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => disableMutation.mutate()}
              disabled={disableMutation.isPending}
              className="gap-1.5"
            >
              {disableMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
              Disable
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => enableMutation.mutate({ forwardingNumber: forwardingNumber || undefined })}
              disabled={!canEnable || enableMutation.isPending}
              className="gap-1.5"
            >
              {enableMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              Enable
            </Button>
          )
        }
      >
        {!canEnable && !enabled && (
          <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>Call centre requires a <span className="font-semibold">{plans.business.name}</span> plan (R{plan.price}/mo).</p>
          </div>
        )}

        {!enabled && canEnable && (
          <div className="space-y-3 px-1">
            <div className="space-y-1.5">
              <Label htmlFor="forwarding-number">Your existing phone number (optional)</Label>
              <Input
                id="forwarding-number"
                placeholder="e.g. +27 11 123 4567"
                value={forwardingNumber}
                onChange={(e) => setForwardingNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the number customers already call. After enabling, we'll give you a Retell number to forward calls to.
              </p>
            </div>
          </div>
        )}

        {enabled && (
          <div className="space-y-3 px-1">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
                <CheckCircle2 className="h-4 w-4" /> Active
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Your phone number</span>
              <span className="text-sm font-mono">{status?.callCentreForwardingNumber ?? "Not set"}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">AI agent number</span>
              <span className="text-sm font-mono">{status?.retellPhoneNumber ?? "-"}</span>
            </div>
            {status?.retellPhoneNumber && status?.callCentreForwardingNumber && (
              <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-200 text-blue-800 text-sm">
                <ArrowRightCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>
                  Forward calls from <span className="font-mono font-semibold">{status.callCentreForwardingNumber}</span> to <span className="font-mono font-semibold">{status.retellPhoneNumber}</span> in your phone/carrier settings.
                </p>
              </div>
            )}
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Agent ID</span>
              <span className="text-sm font-mono">{status?.retellAgentId ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Knowledge base</span>
              <span className="text-sm font-mono">{status?.retellKnowledgeBaseId ?? "-"}</span>
            </div>
          </div>
        )}
      </SectionShell>

      <SectionShell
        icon={MessageSquare}
        tint={TINTS.blue}
        title="Calls"
        description="View and manage inbound call records."
      >
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/calls">
            View calls <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </SectionShell>
    </div>
  );
}
