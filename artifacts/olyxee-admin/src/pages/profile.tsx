import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Loader2,
  LogOut,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  Building2,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useBusiness, useDeleteBusiness, useUpdateBusiness } from "@/hooks/use-supabase-queries";
import { BUSINESS_TYPES } from "@/components/business-type-selector";

// Self-service profile editing for the signed-in admin: name, email, password,
// and account deletion. Reachable from the sidebar (click your name) or /profile.
//
// UX choices:
//  - Big avatar + identity card at the top so you see "this is me" instantly.
//  - Each concern lives in its own bordered card so the page reads top-to-bottom
//    as a clear checklist: who you are, your details, your password, sign out,
//    and - last, walled off in red - deleting the account.
//  - Password is collapsed by default behind a "Change password" toggle -
//    most visits are just to update name/email.
//  - Account deletion sits here (not in Settings) because it's a personal,
//    account-level action. It's guarded by a type-to-confirm dialog.
export default function ProfilePage() {
  const { user, updateProfile, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const { data: business } = useBusiness(user?.businessId);
  const deleteMutation = useDeleteBusiness();
  const updateBusiness = useUpdateBusiness();

  // ── Account info ─────────────────────────────────────────────
  const [info, setInfo] = useState({ name: "", email: "" });
  const [loaded, setLoaded] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);

  // ── Password ─────────────────────────────────────────────────
  const [showPwdSection, setShowPwdSection] = useState(false);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });
  const [savingPwd, setSavingPwd] = useState(false);

  // ── Delete account ───────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [businessTypeLoaded, setBusinessTypeLoaded] = useState(false);

  useEffect(() => {
    if (user && !loaded) {
      setInfo({ name: user.name, email: user.email });
      setLoaded(true);
    }
  }, [user, loaded]);

  useEffect(() => {
    if (business && !businessTypeLoaded) {
      setBusinessType(business.business_type ?? "");
      setBusinessTypeLoaded(true);
    }
  }, [business, businessTypeLoaded]);

  const infoDirty =
    loaded && user != null && (info.name !== user.name || info.email !== user.email);

  // Cheap-and-cheerful password strength: rewards length and character variety.
  // Returns 0..4 (Weak → Strong). Pure UX hint - server still enforces rules.
  const pwdStrength = useMemo(() => {
    const p = pwd.next;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
    return Math.min(4, score);
  }, [pwd.next]);

  const strengthMeta = [
    { label: "Too short", color: "bg-muted" },
    { label: "Weak", color: "bg-red-500" },
    { label: "Fair", color: "bg-amber-500" },
    { label: "Good", color: "bg-emerald-500" },
    { label: "Strong", color: "bg-emerald-600" },
  ][pwdStrength];

  const pwdMatchState: "idle" | "match" | "mismatch" =
    !pwd.confirm ? "idle" : pwd.confirm === pwd.next ? "match" : "mismatch";

  const canChangePwd =
    pwd.current.length > 0 &&
    pwd.next.length >= 8 &&
    pwd.confirm.length > 0 &&
    pwdMatchState === "match";

  const businessName = business?.name ?? "";
  const businessTypeDirty = businessTypeLoaded && businessType !== (business?.business_type ?? "");
  const deleteMatches =
    confirmText.trim().toLowerCase() === businessName.trim().toLowerCase() &&
    businessName.trim().length > 0;

  const handleSaveInfo = async () => {
    if (!info.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!info.email.trim()) {
      toast.error("Email is required");
      return;
    }
    setSavingInfo(true);
    const result = await updateProfile({
      name: info.name.trim(),
      email: info.email.trim(),
    });
    setSavingInfo(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Profile updated");
    }
  };

  const handleChangePassword = async () => {
    if (!canChangePwd) return;
    setSavingPwd(true);
    const result = await updateProfile({
      currentPassword: pwd.current,
      newPassword: pwd.next,
    });
    setSavingPwd(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Password changed");
      setPwd({ current: "", next: "", confirm: "" });
      setShowPwd({ current: false, next: false, confirm: false });
      setShowPwdSection(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setLocation("/login");
  };

  const handleSaveBusinessType = async () => {
    if (!user) return;
    if (!businessType) {
      toast.error("Choose a business type");
      return;
    }
    try {
      await updateBusiness.mutateAsync({ id: user.businessId, business_type: businessType });
      toast.success("Business profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update business profile");
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteMatches || deleteMutation.isPending) return;
    try {
      await deleteMutation.mutateAsync(user!.businessId);
      toast.success("Account deleted");
      // Cookie is cleared server-side; clear client-side auth state too so the
      // protected routes stop hitting the API with a now-invalid session.
      await signOut().catch(() => {});
      setDeleteOpen(false);
      setLocation("/");
    } catch {
      toast.error("Couldn't delete your account. Please try again.");
    }
  };

  if (!user) return null;

  const fullName = user.name || user.email;
  const initial = (fullName || "U").charAt(0).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-10">
      {/* ─── Identity card ──────────────────────────────────────── */}
      <header className="flex items-center gap-4 rounded-3xl border border-border/70 bg-gradient-to-br from-primary/[0.08] via-card to-card p-5 shadow-sm sm:p-6">
        <Avatar className="h-16 w-16 flex-shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">{fullName}</h1>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              {user.role}
            </Badge>
            {businessName && (
              <Badge variant="outline" className="gap-1 font-normal">
                <Building2 className="h-3 w-3" />
                {businessName}
              </Badge>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-500">
              <span className="h-1.5 w-1.5 bg-emerald-500 inline-block" />
              Signed in
            </span>
          </div>
        </div>
      </header>

      {/* ─── Account info form ──────────────────────────────────── */}
      <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Account details</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            These save as soon as you hit Save - no waiting.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profileName" className="text-xs font-normal text-muted-foreground">
              Full name
            </Label>
            <Input
              id="profileName"
              value={info.name}
              onChange={(e) => setInfo((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Jane Smith"
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profileEmail" className="text-xs font-normal text-muted-foreground">
              Email
            </Label>
            <Input
              id="profileEmail"
              type="email"
              value={info.email}
              onChange={(e) => setInfo((f) => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com"
              className="h-11"
            />
            <p className="text-[11px] text-muted-foreground">Used to sign in.</p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <span
              className={cn(
                "text-xs transition-opacity",
                infoDirty ? "text-amber-600 dark:text-amber-500 opacity-100" : "opacity-0",
              )}
              aria-live="polite"
            >
              {infoDirty ? "You have unsaved changes." : ""}
            </span>
            <Button
              size="sm"
              onClick={handleSaveInfo}
              disabled={!infoDirty || savingInfo}
              className="gap-1.5"
            >
              {savingInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {savingInfo ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground"/><h2 className="text-sm font-semibold">Business profile</h2></div>
          <p className="mt-1 text-xs text-muted-foreground">Account-level details about the business you operate.</p>
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <div className="space-y-1.5"><Label className="text-xs font-normal text-muted-foreground">Business name</Label><div className="flex h-11 items-center rounded-xl bg-muted/40 px-3 text-sm font-medium">{businessName || "Not set"}</div><p className="text-[11px] text-muted-foreground">Change branding and customer-facing names in Settings.</p></div>
          <div className="space-y-1.5"><Label className="text-xs font-normal text-muted-foreground">Business type</Label><div className="flex h-11 items-center rounded-xl bg-muted/40 px-3 text-sm font-medium">{businessType || "Not set"}</div><p className="text-[11px] text-muted-foreground">Chosen when your account was created — it can't be changed here.</p></div>
        </div>
      </section>

      {/* ─── Password (collapsed by default) ─────────────────────── */}
      <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
        {!showPwdSection ? (
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Password</Label>
              <p className="text-xs text-muted-foreground">
                Update it any time - your current password is kept private.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowPwdSection(true)}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Change password
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Change password</Label>
                <p className="text-xs text-muted-foreground">
                  Pick something at least 8 characters. Longer is stronger.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPwdSection(false);
                  setPwd({ current: "", next: "", confirm: "" });
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>

            <PasswordField
              id="pwdCurrent"
              label="Current password"
              value={pwd.current}
              onChange={(v) => setPwd((p) => ({ ...p, current: v }))}
              visible={showPwd.current}
              onToggleVisible={() => setShowPwd((s) => ({ ...s, current: !s.current }))}
              autoComplete="current-password"
            />

            <PasswordField
              id="pwdNext"
              label="New password"
              value={pwd.next}
              onChange={(v) => setPwd((p) => ({ ...p, next: v }))}
              visible={showPwd.next}
              onToggleVisible={() => setShowPwd((s) => ({ ...s, next: !s.next }))}
              autoComplete="new-password"
            />

            {/* Strength meter - appears only while typing */}
            {pwd.next.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 transition-colors",
                        i <= pwdStrength ? strengthMeta.color : "bg-muted",
                      )}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Strength: <span className="text-foreground font-medium">{strengthMeta.label}</span>
                </p>
              </div>
            )}

            <PasswordField
              id="pwdConfirm"
              label="Confirm new password"
              value={pwd.confirm}
              onChange={(v) => setPwd((p) => ({ ...p, confirm: v }))}
              visible={showPwd.confirm}
              onToggleVisible={() => setShowPwd((s) => ({ ...s, confirm: !s.confirm }))}
              autoComplete="new-password"
              hint={
                pwdMatchState === "match" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-500">
                    <Check className="h-3 w-3" /> Passwords match
                  </span>
                ) : pwdMatchState === "mismatch" ? (
                  <span className="text-red-600 dark:text-red-500">Passwords don't match yet.</span>
                ) : null
              }
            />

            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={handleChangePassword}
                disabled={!canChangePwd || savingPwd}
                className="gap-1.5"
              >
                {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {savingPwd ? "Updating…" : "Update password"}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ─── Sign out ───────────────────────────────────────────── */}
      <section className="flex items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">Sign out</Label>
          <p className="text-xs text-muted-foreground">
            End your session on this device.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="gap-1.5 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </section>

      {/* ─── Danger zone: delete account ─────────────────────────── */}
      <section className="overflow-hidden rounded-3xl border border-destructive/40 bg-destructive/[0.03]">
        <div className="px-5 py-4 border-b border-destructive/20">
          <h2 className="text-sm font-semibold text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Danger zone
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Irreversible actions for your whole account.
          </p>
        </div>

        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Delete account
            </h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              Permanently delete{" "}
              <span className="font-medium text-foreground">{businessName || "this account"}</span>,
              along with all customers, orders, tracking events, email notifications,
              audit logs, and team members. This cannot be undone.
            </p>
          </div>

          <AlertDialog
            open={deleteOpen}
            onOpenChange={(next) => {
              setDeleteOpen(next);
              if (!next) setConfirmText("");
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="gap-2 self-start sm:self-auto whitespace-nowrap"
                data-testid="button-open-delete-account"
              >
                <Trash2 className="h-4 w-4" />
                Delete account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Delete your account?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      This action is <span className="font-medium text-foreground">permanent</span>.
                      Everything in your account - customers, orders, tracking events,
                      email logs, and team members - will be erased.
                    </p>
                    <p>
                      To confirm, type the business name{" "}
                      <span className="font-medium text-foreground">{businessName}</span>{" "}
                      below.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-2 py-2">
                <Label htmlFor="confirm-account" className="text-[13px]">
                  Business name
                </Label>
                <Input
                  id="confirm-account"
                  autoComplete="off"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={businessName}
                  className="h-10"
                  data-testid="input-confirm-account-name"
                />
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    void handleDeleteAccount();
                  }}
                  disabled={!deleteMatches || deleteMutation.isPending}
                  className="bg-destructive text-white hover:bg-destructive/90 gap-2"
                  data-testid="button-confirm-delete-account"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete forever
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  );
}

// ─── Password field with show/hide toggle ─────────────────────────────────────
// Local helper so each password input has a consistent eye-toggle + optional
// inline hint underneath (for the match indicator). Avoids three near-identical
// blocks in the main component.
function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  autoComplete: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="h-11 pr-10"
        />
        <button
          type="button"
          onClick={onToggleVisible}
          className="absolute right-0 top-0 h-11 w-10 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint ? <p className="text-[11px]">{hint}</p> : null}
    </div>
  );
}
