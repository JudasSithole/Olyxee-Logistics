import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCustomers, useCreateCustomer } from "@/hooks/use-supabase-queries";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Building2, Phone, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

function CustomerAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "h-16 w-16" : "h-8 w-8";
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "C";
  return (
    <div aria-label={name} className={`${dim} flex flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary`}>{initials}</div>
  );
}

function CreateCustomerDialog({ onSuccess, businessId }: { onSuccess: () => void; businessId: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", companyName: "", address: "" });
  const createMutation = useCreateCustomer();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      { business_id: businessId, full_name: form.fullName, email: form.email, phone: form.phone || undefined, company_name: form.companyName || undefined, address: form.address || undefined },
      {
        onSuccess: () => {
          toast.success("Customer created successfully");
          setOpen(false);
          setForm({ fullName: "", email: "", phone: "", companyName: "", address: "" });
          onSuccess();
        },
        onError: () => toast.error("Failed to create customer"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New Customer</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl">Add a customer</DialogTitle>
          <p className="text-sm leading-6 text-muted-foreground">These details are reused on orders, invoices, and delivery emails.</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
            <div className="col-span-2"><p className="font-semibold">Primary contact</p><p className="mt-1 text-xs text-muted-foreground">Who should receive invoices and updates?</p></div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="fullName">Full name *</Label>
              <Input id="fullName" autoFocus placeholder="e.g. Lethabo Scofield" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" placeholder="name@company.co.za" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" type="tel" placeholder="071 234 5678" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company name</Label>
              <Input id="companyName" placeholder="Optional" value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="address">Billing or delivery address</Label>
              <Input id="address" placeholder="Street, suburb, city, postal code" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          <Button type="submit" size="lg" className="h-12 w-full rounded-xl" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Adding customer..." : "Add customer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Tri-state filter values:
//   "any"  → don't send the param
//   "yes"  → hasX=true
//   "no"   → hasX=false
export default function CustomersPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [querySearch, setQuerySearch] = useState("");

  const { data, isLoading, refetch } = useCustomers(user?.businessId, {
    search: querySearch || undefined,
    limit: 20,
    page,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuerySearch(search);
    setPage(1);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-gradient-to-br from-primary/[0.08] via-background to-background p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Customer directory</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Keep billing and delivery contacts ready for every new order.</p>
        </div>
        <CreateCustomerDialog onSuccess={() => refetch()} businessId={user?.businessId ?? ""} />
      </div>

      <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="space-y-3 border-b border-border/60 bg-muted/20 p-4 sm:p-5">
          <div><h2 className="text-lg font-semibold">All customers</h2><p className="mt-0.5 text-sm text-muted-foreground">{data?.total ?? 0} {data?.total === 1 ? "customer" : "customers"}</p></div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="h-11 rounded-xl bg-background pl-9" placeholder="Search name, email, or company" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button type="submit" className="h-11 rounded-xl" variant="secondary">Search</Button>
          </form>

        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 flex-shrink-0" />
                  <Skeleton className="h-5 flex-1" />
                </div>
              ))}
            </div>
          ) : !data?.customers.length ? (
            <div className="px-5 py-16 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Users className="h-8 w-8" /></div><h3 className="mt-5 text-lg font-semibold">{querySearch ? "No matching customers" : "Add your first customer"}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{querySearch ? "Try another name, email address, or company." : "Customer information will be reused when you create orders and generate invoices."}</p></div>
          ) : (
            <>
              <div className="hidden md:block"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-5"></TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Since</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.customers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer hover:bg-muted/40 group"
                      onClick={() => navigate(`/customers/${customer.id}`)}
                    >
                      <TableCell className="pl-5">
                        <CustomerAvatar name={customer.full_name} />
                      </TableCell>
                      <TableCell><p className="font-semibold">{customer.full_name}</p><p className="mt-1 text-xs text-muted-foreground">{customer.email}</p></TableCell>
                      <TableCell><p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5" />{customer.phone ?? "No phone"}</p></TableCell>
                      <TableCell className="text-muted-foreground">{customer.company_name ? <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{customer.company_name}</span> : "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(customer.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>
              <div className="divide-y divide-border/60 md:hidden">{data.customers.map(customer => <Link key={customer.id} href={`/customers/${customer.id}`} className="flex items-center gap-3 p-4"><CustomerAvatar name={customer.full_name} /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{customer.full_name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{customer.company_name || customer.email}</p></div><ArrowRight className="h-4 w-4 text-muted-foreground" /></Link>)}</div>

              {data.total > 20 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(data.total / 20)}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / 20)} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
