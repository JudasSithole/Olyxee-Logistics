import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Phone, PhoneIncoming, ChevronLeft, AlertTriangle,
} from "lucide-react";
import { safeFormatDate } from "@/lib/date-utils";
import { apiFetch } from "@/lib/api";
import { isFeatureEnabled } from "@/lib/launch";

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

export default function CallsPage() {
  const { user } = useAuth();
  const featureOn = isFeatureEnabled("automatedCallCentre");

  const { data: calls, isLoading, refetch } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const res = await apiFetch<CallRecord[]>("/api/call-centre/calls");
      return res ?? [];
    },
    enabled: !!user?.businessId && featureOn,
  });

  if (!featureOn) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Inbound call records.</p>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            The call centre is not yet available.
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusBadge = (status: CallRecord["status"], escalated: boolean) => {
    if (escalated) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Escalated</Badge>;
    }
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Completed</Badge>;
      case "received":
        return <Badge variant="secondary">Received</Badge>;
      case "in_progress":
        return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">In Progress</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Inbound call records from your AI agent.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !calls?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <PhoneIncoming className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
            No calls yet. Inbound calls will appear here once customers start calling.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <Link key={call.id} href={`/calls/${call.id}`}>
              <Card className="hover:bg-muted/40 transition-colors cursor-pointer">
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-mono font-medium truncate">
                        {call.fromNumber ?? "Unknown caller"}
                      </span>
                      {statusBadge(call.status, call.escalated)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {safeFormatDate(call.createdAt, "MMM d, yyyy · HH:mm")}
                      {call.orderId && (
                        <span className="ml-2">· Order linked</span>
                      )}
                    </p>
                  </div>
                  <ChevronLeft className="h-4 w-4 text-muted-foreground/40 rotate-180 flex-shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
