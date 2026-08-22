import { FC, useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  User,
  ChevronDown,
  Phone,
  MapPin,
  Loader2,
  Mail,
  Ship,
  FileText,
  Package,
  Menu,
  X,
  Anchor,
  Plane,
} from "lucide-react";
import notifyTracking from "@assets/image_1783706089743.png";
import ctaWarehouse from "@assets/cta-warehouse.png";
import olyxeeLogo from "@assets/Order-Loop-LOGO_1786979611771.png";
import oldWayQuotes from "@assets/image_1786981204947.png";
import oldWaySpreadsheets from "@assets/image_1786981215190.png";
import oldWayInbox from "@assets/image_1786981225722.png";
import oldWayPaper from "@assets/image_1786981236403.png";
import airCargoImg from "@assets/air-cargo.png";
import oceanCargoImg from "@assets/ocean-cargo.jpg";
import heroCourier from "@assets/hero-courier.png";
import customerDirectoryPreview from "@assets/customer-directory.png";
import { plans } from "@/lib/launch";

// ─── Data ───────────────────────────────────────────────────────────────
const OLD_WAY_SLIDES = [
  { img: oldWayQuotes, tag: "EXHIBIT A", label: "Quotes live in seventeen folders.", body: "And nobody knows which one is final." },
  { img: oldWaySpreadsheets, tag: "EXHIBIT B", label: "One shipment, four spreadsheets.", body: "All updated by hand. None matching." },
  { img: oldWayInbox, tag: "EXHIBIT C", label: "The inbox is the system.", body: "The bill of lading is in a thread somewhere." },
  { img: oldWayPaper, tag: "EXHIBIT D", label: "Print. Check. Re-check.", body: "Line by line, job by job, every week." },
];

const DEMO_CUSTOMERS = [
  { name: "Cape Cargo Imports", initials: "CC", phone: "+27 83 902 7714", address: "Foreshore · Cape Town" },
];
const DEMO_DETAILS = ["Sea Freight · China → South Africa · 20 ft container"];
const DEMO_REFS = ["FSL-0023-2026"];

const WORKFLOW_STEPS = [
  { label: "Create the job", body: "Customer, cargo, route and air or sea details in one record.", icon: Package },
  { label: "Invoice & payment", body: "Send a professional invoice and record payment manually.", icon: FileText },
  { label: "Move the shipment", body: "Update the right cross-border stage as the cargo progresses.", icon: Ship },
  { label: "Keep customers informed", body: "A branded tracking timeline shows every confirmed update.", icon: MapPin },
];

const FREE_PLAN_ITEMS = [
  "Customers, jobs and shipments",
  "Air and sea freight workflows",
  "Customer tracking and status updates",
  "Invoicing, costs and billing",
  "Margins and profit per job",
  "Quotes and landed-cost estimates",
  "Up to 100 status updates per month",
];

const STARTER_PRICE = `R${plans.free.price}`;

// ─── Components ─────────────────────────────────────────────────────────

type NavProps = {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (val: boolean) => void;
  onWorkflowClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

const Nav: FC<NavProps> = ({ mobileMenuOpen, setMobileMenuOpen, onWorkflowClick }) => (
  <header className="fixed top-0 inset-x-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur-md">
    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3 group">
        <img src={olyxeeLogo} alt="Olyxee Logistics" className="h-9 w-9 object-contain" />
        <span className="text-sm font-semibold tracking-tight text-neutral-900 font-ui">Olyxee Logistics</span>
      </Link>

      <div className="hidden md:flex items-center gap-4">
        <Link href="/upgrade" className="text-[13px] font-medium text-neutral-600 hover:text-neutral-900 transition-colors font-ui">
          Pricing
        </Link>
        <Link href="/login" className="text-[13px] font-medium text-neutral-600 hover:text-neutral-900 transition-colors font-ui">
          Log In
        </Link>
        <Link href="/login?mode=signup" className="text-[13px] font-medium px-5 py-2.5 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors font-ui shadow-sm">
          Create workspace
        </Link>
      </div>

      <button className="md:hidden text-neutral-500 hover:text-neutral-900" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
    </div>

    <AnimatePresence>
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="md:hidden absolute top-16 inset-x-0 border-b border-neutral-200 bg-white shadow-2xl"
        >
          <div className="px-6 py-6 flex flex-col gap-5">
            <Link href="/upgrade" className="text-base font-medium text-neutral-600 block font-ui" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
            <Link href="/login" className="text-base font-medium text-neutral-600 block font-ui" onClick={() => setMobileMenuOpen(false)}>Log In</Link>
            <Link href="/login?mode=signup" className="text-base font-medium text-orange-500 block font-ui" onClick={() => setMobileMenuOpen(false)}>Create workspace</Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </header>
);

const HeroSection = ({ onWorkflowClick }: { onWorkflowClick: (e: React.MouseEvent<HTMLAnchorElement>) => void }) => (
  <section className="relative pt-32 pb-24 md:pt-48 md:pb-40 overflow-hidden bg-neutral-50">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-neutral-50 to-neutral-50 pointer-events-none" />

    <div className="max-w-7xl mx-auto px-6 relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-16 items-center">
      <div className="max-w-2xl">
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="text-[3.2rem] md:text-7xl lg:text-[5rem] font-editorial leading-[1.05] tracking-tight text-neutral-950 mb-6 text-balance">
          Run every cross-border <span className="text-orange-500">freight job</span> in one place.
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="text-lg md:text-xl text-neutral-600 leading-relaxed mb-10 max-w-lg font-ui">
          Quotes, routing, customs, and tracking for South African freight forwarders.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 font-ui">
          <Link href="/login?mode=signup" className="group flex items-center justify-between gap-4 px-7 py-4 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-all font-medium text-[15px] w-full sm:w-auto shadow-sm">
            <span>Create your workspace</span>
            <ArrowUpRight size={18} className="group-hover:rotate-45 transition-transform" />
          </Link>
          <a href="#workflow" className="flex items-center gap-2 px-7 py-4 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 transition-all font-medium text-[15px] text-neutral-900 w-full sm:w-auto justify-center shadow-sm" onClick={onWorkflowClick}>
            See how it works
          </a>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, delay: 0.4 }} className="relative mx-auto w-full max-w-xl scale-110 lg:max-w-none lg:scale-[1.18]">
        <img
          src={heroCourier}
          alt="Logistics operator coordinating deliveries with live customer updates"
          className="w-full h-auto object-contain"
        />
      </motion.div>
    </div>
  </section>
);

const ProblemSection = () => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const intervalId = window.setInterval(() => {
      setActive((current) => (current + 1) % OLD_WAY_SLIDES.length);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <section className="bg-white text-neutral-900 py-24 md:py-32 rounded-t-[2.5rem] md:rounded-t-[4rem] -mt-12 relative z-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16 md:mb-24 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <p className="font-code text-[10px] tracking-[0.2em] text-orange-500 mb-4 uppercase">Operational Friction</p>
            <h2 className="text-4xl md:text-6xl font-editorial leading-none tracking-tight text-balance">
              Sound <span className="text-neutral-500">familiar?</span>
            </h2>
          </div>
          <div className="flex gap-2">
            {OLD_WAY_SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? "w-8 bg-orange-500" : "w-4 bg-neutral-200 hover:bg-neutral-300"}`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.5fr] gap-12 lg:gap-20 items-center">
          <div className="order-2 lg:order-1 flex flex-col gap-6">
            {OLD_WAY_SLIDES.map((item, index) => (
              <button
                key={item.tag}
                onClick={() => setActive(index)}
                className={`text-left group border-l-[3px] pl-6 py-2 transition-all duration-300 ${index === active ? "border-orange-500 opacity-100" : "border-neutral-200 opacity-40 hover:opacity-70"}`}
              >
                <span className="font-code text-[10px] tracking-widest text-neutral-500 block mb-2">{item.tag}</span>
                <h3 className="text-2xl md:text-3xl font-editorial mb-3 text-neutral-900 group-hover:text-orange-500 transition-colors leading-tight">{item.label}</h3>
                <AnimatePresence>
                  {index === active && (
                    <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="text-[15px] font-ui text-neutral-500 leading-relaxed overflow-hidden">
                      {item.body}
                    </motion.p>
                  )}
                </AnimatePresence>
              </button>
            ))}
          </div>
          <div className="order-1 lg:order-2">
            <div className="bg-neutral-100 rounded-3xl p-4 md:p-8 aspect-square md:aspect-[4/3] relative overflow-hidden group border border-neutral-200">
              <AnimatePresence mode="wait">
                <motion.img
                  key={active}
                  src={OLD_WAY_SLIDES[active].img}
                  alt={OLD_WAY_SLIDES[active].label}
                  initial={{ opacity: 0, filter: "blur(10px)", scale: 1.05 }}
                  animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                  exit={{ opacity: 0, filter: "blur(10px)", scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 w-full h-full object-cover rounded-2xl shadow-xl"
                />
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const WorkflowSection = () => (
  <section id="workflow" className="bg-white text-neutral-900 py-24 md:py-32 scroll-mt-16 relative">
    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />
    <div className="max-w-7xl mx-auto px-6">
      <div className="max-w-2xl mb-16 md:mb-24">
        <p className="font-code text-[10px] tracking-[0.2em] text-orange-500 mb-4 uppercase">The OS Workflow</p>
        <h2 className="text-4xl md:text-6xl font-editorial tracking-tight leading-none mb-6">
          Built around the way <span className="text-neutral-500">freight forwarders</span> work.
        </h2>
        <p className="text-neutral-600 text-lg font-ui">
          From quote to delivery, your team manages every step in Olyxee Logistics.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 relative">
        <div className="hidden lg:block absolute top-6 left-10 right-10 h-px bg-neutral-200" />

        {WORKFLOW_STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-center mb-8 relative">
                <Icon size={24} className="text-orange-500" />
                <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded bg-white flex items-center justify-center border border-neutral-200 font-code text-[10px] text-neutral-500">{i + 1}</div>
              </div>
              <h3 className="text-xl font-editorial text-neutral-900 mb-3">{step.label}</h3>
              <p className="text-[15px] font-ui text-neutral-600 leading-relaxed">{step.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

const AirSeaSection = () => (
  <section className="bg-white pb-24 md:pb-32">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="group relative overflow-hidden rounded-[2.5rem] bg-neutral-100 border border-neutral-200 p-8 md:p-12 min-h-[440px] flex flex-col justify-end shadow-sm">
          <img src={oceanCargoImg} alt="Ocean freight" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-65 group-hover:scale-105 transition-all duration-1000" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/35 to-transparent" />
          <div className="relative z-10">
            <Anchor className="w-8 h-8 text-orange-500 mb-6" />
            <h3 className="text-4xl font-editorial text-neutral-900 mb-4">Ocean Freight</h3>
            <p className="text-neutral-600 text-[15px] font-ui leading-relaxed max-w-sm">
              FCL and LCL shipments. Manage vessel tracking, bills of lading, and port authorities seamlessly.
            </p>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-[2.5rem] bg-neutral-100 border border-neutral-200 p-8 md:p-12 min-h-[440px] flex flex-col justify-end shadow-sm">
          <img src={airCargoImg} alt="Air cargo" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-65 group-hover:scale-105 transition-all duration-1000" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/35 to-transparent" />
          <div className="relative z-10">
            <Plane className="w-8 h-8 text-orange-500 mb-6" />
            <h3 className="text-4xl font-editorial text-neutral-900 mb-4">Air Cargo</h3>
            <p className="text-neutral-600 text-[15px] font-ui leading-relaxed max-w-sm">
              Time-critical routing. Fast-track customs clearance and airway bill generation on the fly.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const OrderForm: FC<{ step: number }> = ({ step }) => {
  const customerSelected = step >= 1;
  const shipmentComplete = step >= 2;
  const billingVisible = step >= 3;
  const creating = step === 4;
  const done = step >= 5;
  const cust = DEMO_CUSTOMERS[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-2">
        {["Customer", "Shipment", "Billing"].map((label, index) => {
          const complete = step > index;
          const current = step === index;
          return (
            <div key={label} className={`rounded-xl border px-3 py-2 text-center transition-colors ${complete ? "border-orange-200 bg-orange-50 text-orange-700" : current ? "border-orange-500 bg-white text-neutral-900" : "border-neutral-200 bg-neutral-50 text-neutral-400"}`}>
              <span className="font-code text-[9px] tracking-widest uppercase">{index + 1} · {label}</span>
            </div>
          );
        })}
      </div>

      <div>
        <label className="font-code text-[10px] text-neutral-500 tracking-widest block mb-2 uppercase">Customer</label>
        <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500 ${step === 0 ? "border-orange-500 bg-orange-50/50 shadow-md" : "border-neutral-200 bg-white"}`}>
          {customerSelected ? (
            <>
              <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-medium shrink-0">{cust.initials}</div>
              <div className="min-w-0">
                <div className="text-[15px] font-medium text-neutral-900 font-ui truncate">{cust.name}</div>
                <div className="text-xs text-neutral-500 font-ui truncate">{cust.address}</div>
              </div>
              <Check className="ml-auto text-emerald-500 w-5 h-5 shrink-0" strokeWidth={3} />
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 shrink-0"><User size={18} /></div>
              <span className="text-[15px] text-neutral-400 font-ui">Select customer...</span>
              <ChevronDown className="ml-auto text-neutral-400 w-5 h-5 shrink-0" />
            </>
          )}
        </div>
        <p className="mt-2 text-xs text-neutral-500 font-ui">This customer receives invoice and shipment updates.</p>
      </div>

      <AnimatePresence>
        {customerSelected && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
            <div className="bg-neutral-100/80 p-3.5 rounded-xl flex flex-wrap items-center gap-4 text-xs text-neutral-600 font-ui">
              <span className="font-code text-[9px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded uppercase tracking-widest">Selected</span>
              <div className="flex items-center gap-1.5"><Phone size={14} className="text-neutral-400" /> {cust.phone}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {customerSelected && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
            <label className="font-code text-[10px] text-neutral-500 tracking-widest block mb-2 uppercase">Shipment</label>
            <div className={`rounded-2xl border p-4 transition-all duration-500 ${step === 1 ? "border-orange-500 bg-orange-50/50 shadow-md" : "border-neutral-200 bg-white"}`}>
              <div className="mb-4">
                <p className="font-code text-[9px] tracking-widest text-neutral-500 uppercase mb-2">Transport mode</p>
                <div className="flex gap-2">
                  <span className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-400 font-ui">Air Freight</span>
                  <span className="rounded-lg border border-orange-500 bg-orange-500 px-3 py-2 text-xs text-white font-ui">Sea Freight</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs font-ui">
                {[
                  ["Origin", "China"],
                  ["Destination", "South Africa"],
                  ["Cargo / invoice item", "20 ft container"],
                  ["Service required", "Port-to-door"],
                  ["Weight", "8 500 kg"],
                ].map(([label, value]) => (
                  <div key={label} className={`rounded-lg border px-3 py-2.5 ${shipmentComplete ? "border-neutral-200 bg-white text-neutral-900" : "border-neutral-100 bg-neutral-50 text-neutral-400"}`}>
                    <p className="font-code text-[8px] tracking-widest uppercase text-neutral-400 mb-1">{label}</p>
                    <p className="truncate">{shipmentComplete ? value : "…"}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {billingVisible && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
            <label className="font-code text-[10px] text-neutral-500 tracking-widest block mb-2 uppercase">Billing</label>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900 font-ui">Invoice before delivery</p>
                  <p className="mt-1 font-code text-[9px] tracking-widest text-orange-600 uppercase">Prepaid</p>
                </div>
                <p className="text-sm font-semibold text-neutral-900 font-ui">R48 600</p>
              </div>
            </div>
            <motion.button
              className={`w-full py-4 mt-4 rounded-2xl text-[15px] font-medium flex items-center justify-center gap-2 transition-all font-ui ${done ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : creating ? "bg-orange-500/80 text-white cursor-wait" : "bg-orange-500 text-white shadow-lg shadow-orange-500/20"}`}
            >
              {creating ? <><Loader2 size={18} className="animate-spin" /> Creating Job...</> : done ? <><Check size={18} strokeWidth={3} /> Job Created</> : "Create Job & send invoice"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

type DemoOrderType = {
  ref: string;
  customer: typeof DEMO_CUSTOMERS[0];
  details: string;
  key: number;
};

const SimulatedOrderCreation = () => {
  const [step, setStep] = useState(0);
  const [created, setCreated] = useState<DemoOrderType[]>([]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let mounted = true;
    const run = async () => {
      while (mounted) {
        setCreated([]);
        setStep(0);
        await new Promise((r) => { timeout = setTimeout(r, 1500); });
        if (!mounted) break;
        setStep(1);
        await new Promise((r) => { timeout = setTimeout(r, 1000); });
        if (!mounted) break;
        setStep(2);
        await new Promise((r) => { timeout = setTimeout(r, 1500); });
        if (!mounted) break;
        setStep(3);
        await new Promise((r) => { timeout = setTimeout(r, 2500); });
        if (!mounted) break;
        setStep(4);
        await new Promise((r) => { timeout = setTimeout(r, 800); });
        if (!mounted) break;
        setStep(5);
        setCreated([{
          ref: DEMO_REFS[0],
          customer: DEMO_CUSTOMERS[0],
          details: DEMO_DETAILS[0],
          key: Date.now(),
        }]);
        await new Promise((r) => { timeout = setTimeout(r, 4000); });
      }
    };
    run();
    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto bg-white rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-neutral-200 md:h-[540px]">
      <div className="h-14 border-b border-neutral-200 flex items-center px-4 bg-neutral-100/50 shrink-0">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="mx-auto font-code text-[11px] text-neutral-400 tracking-widest uppercase">
          New Job · {DEMO_REFS[0]}
        </div>
        <div className="w-14" />
      </div>
      <div className="flex-1 grid md:grid-cols-5 bg-[#FAFAFA] overflow-y-auto">
        <div className="md:col-span-3 p-6 md:p-10">
          <OrderForm step={step} />
        </div>
        <div className="md:col-span-2 border-t md:border-t-0 md:border-l border-neutral-200 bg-white p-6 md:p-10">
          <div className="font-code text-[10px] text-neutral-400 tracking-widest mb-6 uppercase">Active Jobs</div>
          <div className="space-y-4">
            <AnimatePresence>
              {created.map((job) => (
                <motion.div key={job.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-code text-[11px] text-orange-500">{job.ref}</span>
                    <span className="text-[9px] font-code bg-emerald-100 text-emerald-700 px-2 py-1 rounded uppercase tracking-widest">Confirmed</span>
                  </div>
                  <div className="text-[15px] font-medium text-neutral-900 font-ui">{job.customer.name}</div>
                  <div className="text-xs text-neutral-500 mt-1 font-ui leading-relaxed">{job.details}</div>
                </motion.div>
              ))}
            </AnimatePresence>
            {created.length === 0 && (
              <div className="text-sm font-ui text-neutral-400 text-center py-12 border-2 border-dashed border-neutral-200 rounded-2xl">
                Jobs appear here as you create them.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ShipmentExampleSection = () => (
  <section className="bg-white text-neutral-900 py-24 md:py-32 rounded-[2.5rem] md:rounded-[4rem] relative z-20 overflow-hidden">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center max-w-2xl mx-auto mb-16 md:mb-24">
        <p className="font-code text-[10px] tracking-[0.2em] text-orange-500 mb-4 uppercase">Interface</p>
        <h2 className="text-4xl md:text-6xl font-editorial tracking-tight mb-6">
          Watch a job come to life.
        </h2>
        <p className="text-neutral-500 text-lg font-ui leading-relaxed">
          Follow the real Customer, Shipment, and Billing flow used to create a sea freight job.
        </p>
      </div>

      <div className="bg-neutral-100 rounded-[2rem] p-4 md:p-8 shadow-lg overflow-hidden border border-neutral-200">
        <SimulatedOrderCreation />
      </div>
    </div>
  </section>
);

const CustomerExperienceSection = () => (
  <section className="bg-neutral-50 py-24 md:py-32 border-y border-neutral-200">
    <div className="max-w-7xl mx-auto px-6">
      <div className="max-w-2xl mb-16 md:mb-20">
        <p className="font-code text-[10px] tracking-[0.2em] text-orange-500 mb-4 uppercase">Customer experience</p>
        <h2 className="text-4xl md:text-5xl font-editorial tracking-tight text-neutral-900 leading-tight mb-6">
          Every customer, ready for the next move.
        </h2>
        <p className="text-neutral-600 text-lg font-ui leading-relaxed">
          Keep customer records, billing contacts, and shipment updates connected from the first job to final delivery.
        </p>
      </div>

      <div className="grid lg:grid-cols-[0.86fr_1.14fr] gap-12 lg:gap-20 items-center">
        <div>
          <p className="font-code text-[10px] tracking-[0.2em] text-neutral-500 mb-4 uppercase">Customer directory</p>
          <h3 className="text-3xl md:text-4xl font-editorial tracking-tight text-neutral-900 leading-tight mb-6">Start every job with the right details.</h3>
          <div className="space-y-4">
            {[
              "One clear customer record for every job",
              "Contacts ready for billing and delivery",
              "Customer details that stay connected to operations",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-neutral-700 font-ui">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                  <Check size={14} strokeWidth={3} />
                </span>
                <span className="text-[15px] font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 rounded-[2.5rem] bg-orange-200/30 blur-3xl" aria-hidden />
          <div className="relative overflow-hidden rounded-[1.5rem] border border-neutral-200 bg-white p-2 shadow-[0_30px_80px_-45px_rgba(24,24,27,0.34)] sm:p-3">
            <img src={customerDirectoryPreview} alt="Olyxee customer directory showing contacts and companies ready for a new order" className="w-full rounded-[1rem] border border-neutral-100" loading="lazy" />
          </div>
        </div>
      </div>

      <div className="mt-20 md:mt-28 pt-16 md:pt-20 border-t border-neutral-200 grid lg:grid-cols-[1fr_1fr] gap-16 items-center">
        <div className="order-2 lg:order-1">
          <p className="font-code text-[10px] tracking-[0.2em] text-neutral-500 mb-4 uppercase">Tracking updates</p>
          <h3 className="text-3xl md:text-4xl font-editorial tracking-tight mb-6 leading-tight">Keep customers in the loop.</h3>
          <p className="text-neutral-600 text-lg font-ui leading-relaxed mb-8 max-w-lg">
            Share a branded tracking page so customers see every confirmed milestone as their shipment moves.
          </p>
          <ul className="space-y-4">
            {[
              "Live status timeline",
              "Upload BOL and commercial invoices",
              "Branded with your logo",
              "Mobile-friendly for clients",
            ].map((item) => (
              <li key={item} className="flex items-center gap-4 text-neutral-700 font-ui">
                <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                  <Check size={14} strokeWidth={3} />
                </div>
                <span className="text-[15px] font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative order-1 lg:order-2">
          <div className="absolute inset-0 bg-orange-200/60 rounded-full blur-[80px] transform translate-x-10 translate-y-10" />
          <img src={notifyTracking} alt="Customer tracking interface" className="relative z-10 w-full max-w-md mx-auto drop-shadow-[0_30px_60px_rgba(0,0,0,0.15)] rounded-[2.5rem] border-[8px] border-white" loading="lazy" />
        </div>
      </div>
    </div>
  </section>
);

const PricingSection = () => (
  <section className="bg-neutral-50 py-24 md:py-40 border-t border-neutral-200">
    <div className="max-w-4xl mx-auto px-6 text-center">
      <h2 className="text-4xl md:text-6xl font-editorial text-neutral-900 mb-6">Simple, operational pricing.</h2>
      <p className="text-neutral-600 text-lg font-ui mb-16 max-w-xl mx-auto leading-relaxed">
        One plan to run your entire freight forwarding business. No hidden fees, no per-user limits.
      </p>

      <div className="bg-white border border-neutral-200 rounded-[2.5rem] p-8 md:p-14 max-w-[420px] mx-auto text-left relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />

        <div className="relative z-10">
          <div className="font-code text-[11px] tracking-[0.2em] text-orange-500 mb-4 uppercase">{plans.free.name}</div>
          <div className="flex items-baseline gap-2 mb-10 border-b border-neutral-200 pb-10">
            <span className="text-6xl font-editorial text-neutral-900">{STARTER_PRICE}</span>
            <span className="text-neutral-500 font-ui">/month</span>
          </div>

          <ul className="space-y-5 mb-12">
            {FREE_PLAN_ITEMS.map((item, i) => (
              <li key={i} className="flex items-start gap-4 text-neutral-600 font-ui">
                <Check size={18} className="text-orange-500 shrink-0 mt-0.5" />
                <span className="text-[15px] leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>

          <Link href="/login?mode=signup" className="block w-full py-4 text-center rounded-2xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors font-ui text-[15px] shadow-sm">
            Start your free trial
          </Link>
        </div>
      </div>
    </div>
  </section>
);

const CTASection = () => (
  <section className="relative py-32 md:py-48 overflow-hidden bg-white">
    <img src={ctaWarehouse} alt="Warehouse operations" className="absolute inset-0 w-full h-full object-cover opacity-10 mix-blend-multiply" loading="lazy" />
    <div className="absolute inset-0 bg-gradient-to-t from-white via-white/90 to-transparent" />

    <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
      <h2 className="text-5xl md:text-7xl font-editorial text-neutral-900 mb-10 text-balance">
        Ready to standardize your <span className="text-orange-500">freight ops?</span>
      </h2>
      <Link href="/login?mode=signup" className="inline-flex items-center gap-3 px-8 py-4 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors text-[15px] font-medium font-ui shadow-lg shadow-orange-500/20">
        Create your workspace
        <ArrowRight size={18} />
      </Link>
    </div>
  </section>
);

const Landing: FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleWorkflowClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const workflow = document.getElementById("workflow");
    if (!workflow) return;

    window.history.replaceState(null, "", "#workflow");
    const top = workflow.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen w-full bg-white text-neutral-900 selection:bg-orange-500/30 selection:text-neutral-900 overflow-x-hidden">
      <style>{`
        .font-editorial { font-family: 'Manrope', 'Inter', system-ui, sans-serif; font-weight: 700; letter-spacing: -0.045em; }
        .font-ui { font-family: 'Manrope', 'Inter', system-ui, -apple-system, sans-serif; }
        .font-code { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace; }
      `}</style>

      <Nav mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} onWorkflowClick={handleWorkflowClick} />

      <main>
        <HeroSection onWorkflowClick={handleWorkflowClick} />
        <ProblemSection />
        <WorkflowSection />
        <AirSeaSection />
        <ShipmentExampleSection />
        <CustomerExperienceSection />
        <PricingSection />
        <CTASection />
      </main>

      <SiteFooter />
    </div>
  );
};

// ─── SiteFooter ──────────────────────────────────────────────────────────
// Exported for other pages (e.g. the light contact page) that compose the
// standalone footer on a white background. Uses an inline monospace style so
// it renders correctly outside the Landing page's scoped font utilities.
const footerMono = { fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace' };

export const SiteFooter: FC = () => (
  <footer className="border-t border-neutral-200 bg-white px-4 sm:px-8 pt-16 pb-10">
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-12 gap-y-12 gap-x-8">
        {/* Brand */}
        <div className="col-span-2 md:col-span-5">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <img src={olyxeeLogo} alt="Olyxee Logistics logo" className="h-9 w-9 object-contain" />
            <span className="text-xl font-bold tracking-tight">Olyxee Logistics</span>
          </Link>
          <p className="mt-5 text-sm text-neutral-600 leading-relaxed max-w-sm">
            One place for freight forwarders to run customers, orders, invoices,
            payments, and shipments.
          </p>
          <Link
            href="/login?mode=signup"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900 hover:gap-2.5 transition-all"
          >
            Create your workspace <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Company */}
        <div className="col-span-1 md:col-span-2">
          <p style={footerMono} className="text-[10px] tracking-[0.25em] text-neutral-400 mb-4">
            COMPANY
          </p>
          <ul className="space-y-3 text-sm">
            <li>
              <a
                href="https://olyxee.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-700 hover:text-neutral-950 inline-flex items-center gap-1"
              >
                About Olyxee <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </li>
            <li>
              <Link href="/contact" className="text-neutral-700 hover:text-neutral-950">
                Contact us
              </Link>
            </li>
            <li>
              <Link href="/login" className="text-neutral-700 hover:text-neutral-950">
                Log In
              </Link>
            </li>
          </ul>
        </div>

        {/* Legal */}
        <div className="col-span-1 md:col-span-2">
          <p style={footerMono} className="text-[10px] tracking-[0.25em] text-neutral-400 mb-4">
            LEGAL
          </p>
          <ul className="space-y-3 text-sm">
            <li>
              <a
                href="https://olyxee.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-700 hover:text-neutral-950"
              >
                Terms of Service
              </a>
            </li>
            <li>
              <a
                href="https://olyxee.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-700 hover:text-neutral-950"
              >
                Privacy Policy
              </a>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div className="col-span-2 md:col-span-3">
          <p style={footerMono} className="text-[10px] tracking-[0.25em] text-neutral-400 mb-4">
            GET IN TOUCH
          </p>
          <ul className="space-y-3 text-sm">
            <li>
              <a
                href="mailto:scofield@olyxee.com"
                className="flex items-center gap-2.5 text-neutral-700 hover:text-neutral-950"
              >
                <Mail className="w-4 h-4 text-neutral-400" />
                scofield@olyxee.com
              </a>
            </li>
            <li>
              <a
                href="tel:+27712233272"
                className="flex items-center gap-2.5 text-neutral-700 hover:text-neutral-950"
              >
                <Phone className="w-4 h-4 text-neutral-400" />
                +27 71 223 3272
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Divider + bottom row */}
      <div className="mt-14 pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p style={footerMono} className="text-[11px] tracking-[0.2em] text-neutral-400">
          © {new Date().getFullYear()} OLYXEE LOGISTICS · ALL RIGHTS RESERVED
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-x-6 gap-y-2">
          <a
            href="https://olyxee.com"
            target="_blank"
            rel="noopener noreferrer"
            style={footerMono}
            className="group text-[11px] tracking-[0.2em] text-neutral-400 hover:text-neutral-900 transition-colors inline-flex items-center gap-1.5"
          >
            DEVELOPED BY OLYXEE
            <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
          </a>
          <p style={footerMono} className="text-[11px] tracking-[0.2em] text-neutral-400">
            MADE IN SOUTH AFRICA
          </p>
        </div>
      </div>
    </div>
  </footer>
);

export default Landing;
