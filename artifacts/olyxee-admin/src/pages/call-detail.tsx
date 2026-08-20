import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, PhoneOff, AlertTriangle,
  PhoneIncoming, Mail, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";
import { isFeatureEnabled } from "@/lib/launch";
import { EmptyState } from "@/components/page-loader";

interface CallRecord {
  id: string;
  businessId: string;
  retellCallId: string | null;
  fromNumber: string | null;
  orderId: string | null;
  status: "received" | "in_progress" | "completed" | "escalated" | "failed";
  transcript: string | null;
  summary: string | null;
  escalated: boolean;
  createdAt: string;
}

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const featureOn = isFeatureEnabled("automatedCallCentre");

  const { data: call, isLoading } = useQuery({
    queryKey: ["call", id],
    queryFn: async () => {
      const res = await apiFetch<CallRecord>(`/api/call-centre/calls/${id}`);
      return res;
    },
    enabled: !!id && !!user?.businessId && featureOn,
  });

  if (!featureOn) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Call Detail</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Call information and transcript.</p>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            The call centre is not yet available.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!call) {
    return (
      <EmptyState
        icon={<PhoneOff className="h-12 w-12" />}
        title="Call not found"
        description="This call may have been deleted or the ID is incorrect."
        action={
          <Link href="/calls">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back to calls
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <Link href="/calls">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Calls
          </Button>
        </Link>
        {call.orderId && (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={`/orders/${call.orderId}`}>
              View order <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>

      <div className="pb-5 border-b">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold font-mono tracking-tight">
            {call.fromNumber ?? "Unknown caller"}
          </h1>
          {call.escalated && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Escalated
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {format(new Date(call.createdAt), "MMM d, yyyy · HH:mm")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {call.summary && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">AI Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {call.summary}
                </p>
              </CardContent>
            </Card>
          )}

          {call.transcript && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {call.transcript}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <PhoneIncoming className="h-3.5 w-3.5" />
                Call Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{call.status.replace("_", " ")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Caller</span>
                <span className="font-mono">{call.fromNumber ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Retell ID</span>
                <span className="font-mono truncate max-w-[180px]">{call.retellCallId ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Escalated</span>
                <span className={call.escalated ? "text-red-600 font-medium" : "text-muted-foreground"}>
                  {call.escalated ? "Yes" : "No"}
                </span>
              </div>
            </CardContent>
          </Card>

          {call.orderId && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  Linked Order
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
                  <Link href={`/orders/${call.orderId}`}>
                    View order <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
