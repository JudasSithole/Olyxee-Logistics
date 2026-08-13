import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { useBusiness, useUpdateBusiness } from "@/hooks/use-supabase-queries";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/page-loader";
import { BusinessTypeSelector } from "@/components/business-type-selector";
import bgImage from "@assets/image_1778124687840.png";

export default function BusinessTypePage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: business, isLoading } = useBusiness(user?.businessId);
  const updateMutation = useUpdateBusiness();

  const [selected, setSelected] = useState<string>("");

  // Pre-fill if the user already set a type and came back to this step.
  useEffect(() => {
    if (business?.business_type) setSelected(business.business_type);
  }, [business?.business_type]);

  async function handleContinue() {
    if (!selected) return;
    try {
      await updateMutation.mutateAsync({ id: user!.businessId, business_type: selected });
      setLocation("/onboarding");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save your business type",
      );
    }
  }

  return (
    <div
      className="relative min-h-dvh bg-[hsl(220,20%,10%)] bg-cover bg-center"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Blurred background overlay */}
      <div className="absolute inset-0 backdrop-blur-md bg-black/55" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-215 items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl ring-1 ring-black/5 px-8 py-10">
          {/* Header */}
          <div className="mb-8">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-[hsl(220,9%,46%)]">
              Step 1 of 2
            </p>
            <h1 className="text-[26px] font-semibold text-[hsl(220,20%,10%)] tracking-tight mt-2">
              What kind of business are you?
            </h1>
            <p className="text-[15px] text-[hsl(220,9%,46%)] mt-1.5">
              Choose your industry so Olyxee Logistics can tailor the experience for
              your team. You can change this later in Settings.
            </p>
          </div>

          {isLoading ? (
            <PageLoader />
          ) : (
            <div className="space-y-8">
              <BusinessTypeSelector value={selected} onChange={setSelected} />

              <div className="flex items-center justify-between gap-4 pt-2 border-t border-border/60">
                {selected ? (
                  <p className="text-sm text-muted-foreground">
                    Selected:{" "}
                    <span className="font-semibold text-foreground">
                      {selected}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a business type to continue.
                  </p>
                )}

                <Button
                  onClick={handleContinue}
                  disabled={!selected || updateMutation.isPending}
                  className="gap-2 bg-[hsl(220,20%,10%)] hover:bg-[hsl(220,20%,20%)] text-white font-medium px-6 h-11"
                  data-testid="button-business-type-continue"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
