import { FC, ReactNode, useEffect, useRef, useState, type WheelEvent } from "react";
import notifyTracking from "@assets/image_1783706089743.png";
import ctaWarehouse from "@assets/cta-warehouse.png";
import olyxeeLogo from "@assets/Order-Loop-LOGO_1786979611771.png";
import oldWayQuotes from "@assets/image_1786981204947.png";
import oldWaySpreadsheets from "@assets/image_1786981215190.png";
import oldWayInbox from "@assets/image_1786981225722.png";
import oldWayPaper from "@assets/image_1786981236403.png";
import freightVisual from "@assets/image_1786981575568.png";
import airCargoImg from "@assets/air-cargo.png";
import heroCourier from "@assets/hero-courier.png";
import oceanCargoImg from "@assets/ocean-cargo.jpg";
import { plans } from "@/lib/launch";

// ─── "The old way" exhibit showcase ──────────────────────────────────────────
const OLD_WAY_SLIDES = [
  { img: oldWayQuotes, tag: "EXHIBIT A", label: "Quotes live in seventeen folders.", body: "And nobody knows which one is final." },
  { img: oldWaySpreadsheets, tag: "EXHIBIT B", label: "One shipment, four spreadsheets.", body: "All updated by hand. None matching." },
  { img: oldWayInbox, tag: "EXHIBIT C", label: "The inbox is the system.", body: "The bill of lading is in a thread somewhere." },
  { img: oldWayPaper, tag: "EXHIBIT D", label: "Print. Check. Re-check.", body: "Line by line, job by job, every week." },
];

const OldWayShowcase: FC<{ active: number }> = ({ active }) => {
  const slide = OLD_WAY_SLIDES[active];

  return (
    <div
      className="relative overflow-hidden rounded-[2.25rem] border border-orange-100 bg-[#fffaf5] p-3 sm:p-5 lg:p-7"
      style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(249,115,22,0.09) 1px, transparent 0)", backgroundSize: "22px 22px" }}
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange-200/30 blur-3xl" aria-hidden />
      <div className="relative mb-4 flex items-center justify-between px-2 sm:mb-6">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          <p style={mono} className="text-[9px] tracking-[0.25em] text-neutral-500">FREIGHT OPERATIONS · EVIDENCE BOARD</p>
        </div>
        <p style={mono} className="text-[9px] tracking-[0.2em] text-neutral-400">CASE 0{active + 1}</p>
      </div>

      <div className="relative grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1" aria-label={`Problem ${active + 1} of ${OLD_WAY_SLIDES.length}`}>
        {OLD_WAY_SLIDES.map((item, index) => (
          <div key={item.tag} className={`group flex min-w-0 items-center gap-3 rounded-2xl border p-2 transition-all ${index === active ? "border-orange-300 bg-white shadow-sm" : "border-white/80 bg-white/65"}`}>
            <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-neutral-100 sm:h-16 sm:w-20">
              <img src={item.img} alt="" className={`h-full w-full object-cover transition-all ${index === active ? "saturate-100" : "saturate-50 opacity-70"}`} />
              <span className={`absolute inset-0 ring-1 ring-inset ${index === active ? "ring-orange-300" : "ring-black/5"}`} />
            </div>
            <div className="min-w-0">
              <span style={mono} className={`text-[8px] tracking-[0.16em] ${index === active ? "text-orange-600" : "text-neutral-400"}`}>0{index + 1} · {item.tag}</span>
              <p className={`mt-1 line-clamp-2 text-[11px] font-medium leading-snug sm:text-xs ${index === active ? "text-neutral-900" : "text-neutral-500"}`}>{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white shadow-[0_28px_70px_-50px_rgba(0,0,0,0.3)]">
        <div className="relative aspect-[16/9] bg-neutral-200 sm:aspect-[16/7]">
          <AnimatePresence mode="wait">
            <motion.img
              key={`img-${active}`}
              src={slide.img}
              alt={slide.label}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" aria-hidden />
          <span style={mono} className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[9px] tracking-[0.2em] text-neutral-600 shadow-sm backdrop-blur-md">EVIDENCE · {slide.tag}</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={`detail-${active}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease }} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
            <div>
              <p style={mono} className="mb-2 text-[9px] tracking-[0.22em] text-orange-600">OPERATIONAL FRICTION</p>
              <h3 style={serif} className="text-2xl leading-tight tracking-tight sm:text-3xl">{slide.label}</h3>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-neutral-500 sm:text-right">{slide.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      </div>
    </div>
  );
};

const ScrollProblemShowcase: FC = () => {
  const [active, setActive] = useState(0);
  const wheelLock = useRef(0);

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) < 12) return;
    const direction = event.deltaY > 0 ? 1 : -1;
    const next = active + direction;
    if (next < 0 || next >= OLD_WAY_SLIDES.length) return;
    event.preventDefault();
    const now = Date.now();
    if (now < wheelLock.current) return;
    wheelLock.current = now + 550;
    setActive(next);
  };

  return (
    <div className="relative" onWheel={handleWheel}>
        <div className="mb-5 flex items-end justify-between gap-5">
          <div>
            <p style={mono} className="mb-2 text-[10px] tracking-[0.3em] text-neutral-400">THE PROBLEM</p>
            <h2 style={serif} className="text-3xl leading-none tracking-tight sm:text-4xl">
              Sound <em className="not-italic text-orange-500">familiar?</em>
            </h2>
          </div>
          <p className="hidden max-w-xs text-right text-sm leading-relaxed text-neutral-500 sm:block">
            One freight problem at a time. Scroll over the card to move through them.
          </p>
        </div>
        <OldWayShowcase active={active} />
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-neutral-500">{active === OLD_WAY_SLIDES.length - 1 ? "Keep scrolling to continue" : "Scroll for the next problem"}</p>
          <p style={mono} className="text-[10px] tracking-[0.2em] text-neutral-400">{String(active + 1).padStart(2, "0")} / {String(OLD_WAY_SLIDES.length).padStart(2, "0")}</p>
        </div>
    </div>
  );
};
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
  AlertTriangle,
  Bell,
  PhoneCall,
  ClipboardList,
  Layers,
  Package,
} from "lucide-react";

const ease = [0.25, 0.1, 0.25, 1] as const;

const serif = { fontFamily: '"Inter", system-ui, -apple-system, sans-serif', fontWeight: 650, letterSpacing: "-0.02em" };
const mono = { fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace' };
const sans = '"Inter", system-ui, -apple-system, sans-serif';

type DemoCustomer = {
  name: string;
  initials: string;
  phone: string;
  address: string;
};

type DemoOrder = {
  ref: string;
  customer: DemoCustomer;
  details: string;
  key: number;
};

const DEMO_CUSTOMERS: DemoCustomer[] = [
  { name: "Thandi Nkosi", initials: "TN", phone: "+27 82 331 4098", address: "Nkosi Trading · Johannesburg" },
  { name: "Pieter van Wyk", initials: "PW", phone: "+27 83 902 7714", address: "Cape Cargo Imports · Cape Town" },
  { name: "Amahle Dube", initials: "AD", phone: "+27 71 448 2065", address: "Dube & Sons Exports · Durban" },
];

const DEMO_DETAILS = [
  "20ft container · Shanghai → Durban · sea freight",
  "Air cargo · 340 kg · Guangzhou → OR Tambo",
  "LCL · 8 CBM · Ningbo → Cape Town",
];

const DEMO_REFS = ["#OLY-2101", "#OLY-2102", "#OLY-2103"];

const STEP_DELAYS = [1500, 1300, 1400, 1000, 800, 2600];

const Caret: FC = () => (
  <motion.span
    aria-hidden
    className="inline-block w-[2px] h-[1em] -mb-[2px] bg-orange-500 ml-[1px]"
    animate={{ opacity: [1, 1, 0, 0] }}
    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
  />
);

type OrderScreenProps = {
  variant: "desktop" | "mobile";
  step: number;
  cust: DemoCustomer;
  custIdx: number;
  detail: string;
  reff: string;
  created: DemoOrder[];
};

const OrderScreen: FC<OrderScreenProps> = ({ variant, step, cust, custIdx, detail, reff, created }) => {
  const custOpen = step === 0;
  const custSelected = step >= 1;
  const detailsActive = step === 1;
  const detailsFilled = step >= 2;
  const ready = step === 3;
  const creating = step === 4;
  const done = step >= 5;

  const form = (
    <div className="flex flex-col gap-3">
      {/* Customer dropdown */}
      <div className="relative">
        <div style={mono} className="text-[8px] tracking-widest text-neutral-400 mb-1">CUSTOMER</div>
        <div
          className={`flex items-center gap-2.5 rounded-xl px-3 h-10 ring-1 transition-colors duration-300 ${
            custOpen ? "ring-orange-400 bg-orange-50/60" : "ring-neutral-200 bg-white"
          }`}
        >
          {custSelected ? (
            <>
              <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-[9px] font-medium flex items-center justify-center shrink-0">
                {cust.initials}
              </span>
              <span className="text-[13px] text-neutral-900 truncate">{cust.name}</span>
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                className="ml-auto shrink-0 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"
              >
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              </motion.span>
            </>
          ) : (
            <>
              <User className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className="text-[13px] text-neutral-400">Select customer</span>
              <ChevronDown className="ml-auto w-3.5 h-3.5 text-neutral-400" />
            </>
          )}
        </div>

        <AnimatePresence>
          {custOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="absolute z-20 left-0 right-0 mt-1.5 bg-white rounded-xl ring-1 ring-neutral-200 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.35)] p-1.5"
            >
              {DEMO_CUSTOMERS.map((c, i) => (
                <div
                  key={c.name}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${i === custIdx ? "bg-orange-50" : ""}`}
                >
                  <span
                    className={`w-6 h-6 rounded-full text-[9px] font-medium flex items-center justify-center shrink-0 ${
                      i === custIdx ? "bg-orange-500 text-white" : "bg-neutral-200 text-neutral-600"
                    }`}
                  >
                    {c.initials}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[12px] text-neutral-900 truncate">{c.name}</div>
                    <div className="text-[10px] text-neutral-400 truncate">{c.address}</div>
                  </div>
                  {i === custIdx && <Check className="ml-auto w-3.5 h-3.5 text-orange-500 shrink-0" strokeWidth={3} />}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Auto-filled customer details */}
      <AnimatePresence>
        {custSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease }}
            className="overflow-hidden"
          >
            <div className="rounded-xl bg-neutral-50 ring-1 ring-neutral-200 p-2.5 space-y-2">
              <span
                style={mono}
                className="inline-block text-[7px] tracking-widest text-emerald-700 bg-emerald-100 rounded px-1.5 py-0.5"
              >
                AUTO-FILLED FROM CUSTOMER
              </span>
              <div className="flex items-center gap-2 text-[11px] text-neutral-600">
                <Phone className="w-3 h-3 text-neutral-400 shrink-0" />
                {cust.phone}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-neutral-600">
                <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                {cust.address}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shipment details */}
      <div>
        <div style={mono} className="text-[8px] tracking-widest text-neutral-400 mb-1">SHIPMENT DETAILS</div>
        <div
          className={`rounded-xl px-3 py-2.5 ring-1 min-h-[3.25rem] flex items-start transition-colors duration-300 ${
            detailsActive ? "ring-orange-400 bg-orange-50/60" : "ring-neutral-200 bg-white"
          }`}
        >
          <AnimatePresence mode="wait">
            {detailsFilled ? (
              <motion.span
                key={detail}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-[13px] text-neutral-900"
              >
                {detail}
              </motion.span>
            ) : detailsActive ? (
              <span className="text-[13px] text-neutral-300 flex items-center">
                Typing shipment details
                <Caret />
              </span>
            ) : (
              <span className="text-[13px] text-neutral-300">Add shipment details…</span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Create button */}
      <motion.button
        type="button"
        animate={creating ? { scale: 0.97 } : { scale: 1 }}
        className={`mt-1 h-10 rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 transition-colors duration-300 ${
          ready || creating || done ? "bg-orange-500 text-white shadow-[0_8px_24px_-8px_rgba(249,115,22,0.7)]" : "bg-neutral-200 text-neutral-400"
        }`}
      >
        {creating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating order…
          </>
        ) : done ? (
          <>
            <Check className="w-3.5 h-3.5" strokeWidth={3} /> Order created
          </>
        ) : (
          "Create order"
        )}
      </motion.button>
    </div>
  );

  const liveList = (
    <div className="flex flex-col min-h-0">
      <div style={mono} className="text-[9px] tracking-widest text-neutral-400 mb-2 px-1">ACTIVE JOBS</div>
      <div className="space-y-2 overflow-hidden">
        <AnimatePresence initial={false}>
          {created.map((o) => (
            <motion.div
              key={o.key}
              layout
              initial={{ opacity: 0, x: 24, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease }}
              className="bg-white rounded-xl px-3 py-2.5 ring-1 ring-neutral-200"
            >
              <div className="flex items-center justify-between gap-2">
                <div style={mono} className="text-[10px] text-neutral-500">{o.ref}</div>
                <span style={mono} className="text-[8px] tracking-widest px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">CONFIRMED</span>
              </div>
              <div className="text-[12px] text-neutral-900 mt-1 truncate">{o.customer.name}</div>
            </motion.div>
          ))}
        </AnimatePresence>
        {created.length === 0 && (
          <div className="text-[11px] text-neutral-300 px-1 py-6 text-center">Jobs appear here as you create them.</div>
        )}
      </div>
    </div>
  );

  if (variant === "mobile") {
    return (
      <div className="w-full h-full bg-gradient-to-b from-neutral-50 to-neutral-100 flex flex-col">
        <div className="pt-7 px-4 pb-3 flex items-center justify-between shrink-0">
          <div>
            <div style={mono} className="text-[8px] tracking-widest text-neutral-400">{reff}</div>
            <div style={serif} className="text-lg text-neutral-900 leading-tight">New order</div>
          </div>
          <div style={mono} className="text-[8px] tracking-widest text-emerald-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {form}
          <div className="mt-4">{liveList}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-neutral-50 to-neutral-100 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-neutral-200/70 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400" />
          <span className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div style={mono} className="text-[10px] tracking-widest text-neutral-400 ml-2">CREATE ORDER · {reff}</div>
      </div>
      <div className="flex-1 grid grid-cols-5 gap-5 p-5 min-h-0">
        <div className="col-span-3">{form}</div>
        <div className="col-span-2">{liveList}</div>
      </div>
    </div>
  );
};

const ScreenFrame: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="w-[620px] h-[400px] max-w-full mx-auto rounded-2xl bg-neutral-900 p-2.5 ring-1 ring-neutral-800 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.45)]">
    <div className="w-full h-full rounded-xl overflow-hidden bg-white">{children}</div>
  </div>
);

const PhoneFrame: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="w-full max-w-[290px] mx-auto">
    <div className="rounded-[2.75rem] bg-neutral-900 p-2.5 ring-1 ring-neutral-800 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.5)]">
      <div className="relative rounded-[2.25rem] overflow-hidden bg-white aspect-[9/19]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 h-5 w-24 rounded-b-2xl bg-neutral-900" />
        {children}
      </div>
    </div>
  </div>
);


// ─── Hero visual: one freight job, fully connected ──────────────────────────
const JOB_TIMELINE = [
  { label: "Quote accepted · order created", meta: "Shanghai → Durban · sea freight", done: true },
  { label: "Invoice sent · payment confirmed", meta: "R48,200 · paid", done: true },
  { label: "Vessel departed", meta: "MSC Kalina · ETA 14 Sep", done: true },
  { label: "Clearance in progress", meta: "Documents organised in the job", done: false },
  { label: "Delivery to customer", meta: "Johannesburg · pending", done: false },
];


// ─── Workflow chain ──────────────────────────────────────────────────────────
const WORKFLOW_STEPS = [
  { label: "Create the job", body: "Customer, cargo, route and air or sea details in one record.", icon: Package },
  { label: "Invoice and confirm payment", body: "Send a professional invoice and record payment manually.", icon: FileText },
  { label: "Move the shipment", body: "Update the right cross-border stage as the cargo progresses.", icon: Ship },
  { label: "Keep customers informed", body: "A branded tracking timeline shows every confirmed update.", icon: MapPin },
];

// ─── Starter plan list ───────────────────────────────────────────────────────
const FREE_PLAN_ITEMS = [
  "Customers, jobs and shipments",
  "Air and sea freight workflows",
  "Customer tracking and status updates",
  "Invoicing, costs and billing",
  "Margins and profit per job",
  "Quotes and landed-cost estimates",
  "Up to 100 status updates per month",
];

// ─── Operational pain rows ───────────────────────────────────────────────────
// ─── Orgni ops interface data ────────────────────────────────────────────────

const Landing: FC = () => {
  return (
    <div className="min-h-screen bg-white text-neutral-900 overflow-x-hidden" style={{ fontFamily: sans }}>
      {/* === HEADER === */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-white/80 border-b border-neutral-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src={olyxeeLogo} alt="Olyxee Logistics logo" className="h-8 w-8 object-contain" />
            <span className="text-base font-bold tracking-tight sm:text-xl"><span className="sm:hidden">Olyxee</span><span className="hidden sm:inline">Olyxee Logistics</span></span>
          </Link>
          <nav className="flex items-center gap-0.5 sm:gap-1">
            <Link href="/upgrade" className="inline-block rounded-full px-2.5 py-2 text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-900 sm:px-3 sm:text-sm">
              Pricing
            </Link>
            <Link href="/login" className="ml-1 text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-full bg-neutral-900 text-white hover:bg-black transition-colors">
              Log In
            </Link>
          </nav>
        </div>
      </header>

      {/* === HERO === */}
      <section className="relative pt-32 sm:pt-40 pb-16 sm:pb-24 px-4 sm:px-8 overflow-hidden">
        {/* soft radial glow behind headline (CargoWise-style) */}
        <div
          aria-hidden
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[70rem] h-[42rem] rounded-full opacity-70"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,237,213,0.9), rgba(255,247,237,0.6), rgba(255,255,255,0))",
          }}
        />
        <div className="relative max-w-7xl mx-auto grid grid-cols-12 gap-x-8 gap-y-14 items-center">
          <div className="col-span-12 lg:col-span-6 text-center lg:text-left">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease }}
            style={serif}
            className="text-[2.6rem] sm:text-[3.8rem] lg:text-[4.4rem] leading-[1.02] tracking-[-0.03em]"
          >
            Run every cross-border
            <br className="hidden sm:block" />{" "}
            <span className="text-orange-500">freight job in one place.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease }}
            className="mt-7 text-base sm:text-lg text-neutral-600 leading-relaxed max-w-xl mx-auto lg:mx-0"
          >
            Give your team one clear workflow for customers, air and sea jobs,
            invoices, shipment updates, tracking, costs and profit.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease }}
            className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-5"
          >
            <Link
              href="/login?mode=signup"
              className="group inline-flex items-center justify-between gap-6 px-8 py-4 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors shadow-[0_20px_50px_-20px_rgba(249,115,22,0.6)]"
            >
              <span className="text-sm font-medium tracking-wide">Create your workspace</span>
              <ArrowUpRight className="w-4 h-4 group-hover:rotate-45 transition-transform duration-500" />
            </Link>
            <Link
              href="#workflow"
              className="inline-flex items-center px-8 py-4 rounded-full bg-white ring-1 ring-neutral-200 text-sm font-medium text-neutral-800 hover:ring-neutral-400 transition-all"
            >
              See how it works
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.65, ease }}
            style={mono}
            className="mt-7 text-[11px] tracking-[0.18em] text-neutral-400"
          >
            STARTER · R{plans.free.price}/MONTH
          </motion.p>

          </div>

          <motion.div
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.45, ease }}
            className="col-span-12 lg:col-span-6"
          >
            <img
              src={heroCourier}
              alt="Logistics operator coordinating deliveries with live customer updates"
              className="w-full max-w-xl mx-auto lg:max-w-none lg:scale-[1.06] h-auto"
            />
          </motion.div>
        </div>
      </section>

      {/* === PAIN - the old way === */}
      <section className="px-4 py-16 sm:px-8 sm:py-20">
        <div className="max-w-7xl mx-auto">
          <div>
            <ScrollProblemShowcase />
          </div>
        </div>
      </section>

      {/* === WORKFLOW === */}
      <section id="workflow" className="scroll-mt-16 border-y border-neutral-200 bg-neutral-100 px-4 py-24 text-neutral-900 sm:px-8 sm:py-32">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-16">
            <p style={mono} className="text-[11px] tracking-[0.3em] text-orange-400 mb-4">THE WORKFLOW</p>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease }}
              style={serif}
              className="text-4xl sm:text-6xl tracking-tight leading-[0.95] mb-6"
            >
              Built around the way <em className="not-italic text-orange-400">freight forwarders</em> work.
            </motion.h2>
            <p className="max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
              From quote to delivery, your team manages every step in Olyxee Logistics.
            </p>
          </div>

          {/* Wide operational rail: thin connecting line, small nodes, interface labels */}
          <div className="relative">
            <div aria-hidden className="absolute left-4 right-4 top-[13px] hidden h-px bg-neutral-300 lg:block" />
            <div aria-hidden className="absolute bottom-2 left-[13px] top-2 w-px bg-neutral-300 lg:hidden" />
            <div className="grid gap-8 lg:gap-6 lg:grid-cols-4">
              {WORKFLOW_STEPS.map((step, i) => {
                const Icon = step.icon;
                const isLast = i === WORKFLOW_STEPS.length - 1;
                return (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.5, delay: i * 0.09, ease }}
                    className="relative flex lg:block gap-5"
                  >
                    <span
                      className={`relative z-10 w-[27px] h-[27px] rounded-full flex items-center justify-center shrink-0 ring-1 ${
                        isLast
                          ? "bg-orange-500 ring-orange-400 text-white"
                          : "bg-white ring-neutral-300 text-orange-500"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
                    </span>
                    <div className="lg:mt-5 min-w-0">
                      <p style={mono} className="mb-1.5 text-[9px] tracking-[0.2em] text-neutral-400">
                        STEP {String(i + 1).padStart(2, "0")}
                      </p>
                      <p className="text-[13px] font-medium leading-snug text-neutral-900">{step.label}</p>
                      <p className="mt-1.5 text-[11px] leading-snug text-neutral-500">{step.body}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* === SOLUTIONS - Air & Ocean === */}
      <section className="py-24 sm:py-32 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-14">
            <p style={mono} className="text-[11px] tracking-[0.3em] text-orange-500 mb-4">SOLUTIONS</p>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease }}
              style={serif}
              className="text-4xl sm:text-6xl tracking-tight leading-[0.98] mb-6"
            >
              Built for every mode. <em className="not-italic text-orange-500">Ready for every move.</em>
            </motion.h2>
            <p className="text-base sm:text-lg text-neutral-600 leading-relaxed max-w-2xl">
              The single platform that powers global logistics from origin to destination.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {[
              {
                label: "Air",
                img: airCargoImg,
                meta: "AIR FREIGHT",
                body: "Fast-moving air jobs with export, transit, and import clearance stages managed end to end.",
              },
              {
                label: "Ocean",
                img: oceanCargoImg,
                meta: "OCEAN FREIGHT",
                body: "Vessel departures, port arrivals, and container milestones tracked on every sea shipment.",
              },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.8, delay: i * 0.12, ease }}
                className="group rounded-[1.75rem] overflow-hidden ring-1 ring-neutral-200 bg-white shadow-[0_30px_80px_-50px_rgba(0,0,0,0.25)]"
              >
                <div className="aspect-[16/9] overflow-hidden bg-neutral-50">
                  <img
                    src={m.img}
                    alt={`${m.label} freight`}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                </div>
                <div className="p-8 sm:p-10">
                  <p style={mono} className="text-[10px] tracking-[0.3em] text-orange-500 mb-3">{m.meta}</p>
                  <h3 style={serif} className="text-3xl sm:text-4xl tracking-tight mb-3">{m.label}</h3>
                  <p className="text-neutral-600 text-sm sm:text-[15px] leading-relaxed max-w-md">{m.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* === REAL-WORLD EXAMPLE === */}
      <section className="py-24 sm:py-32 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-neutral-100 text-neutral-900">
            <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" aria-hidden />
            <div className="relative grid grid-cols-12 gap-8 p-8 sm:p-14 lg:p-16 items-center">
              <div className="col-span-12 lg:col-span-6">
                <p style={mono} className="text-[11px] tracking-[0.3em] text-orange-400 mb-4">MANAGE THE SHIPMENT</p>
                <motion.h2
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.8, ease }}
                  style={serif}
                  className="text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[0.95] mb-6"
                >
                  One China shipment. One clear <em className="not-italic text-orange-400">workflow</em>.
                </motion.h2>
                <p className="max-w-lg text-base leading-relaxed text-neutral-600 sm:text-lg">
                  From the customer's request to final delivery, everything about the job lives together.
                </p>
              </div>
              <div className="col-span-12 lg:col-span-6">
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200 sm:p-8">
                  <div className="flex items-center justify-between mb-7">
                    <div>
                      <div style={mono} className="mb-1 text-[9px] tracking-widest text-neutral-400">ORIGIN</div>
                      <div style={serif} className="text-2xl">Shanghai</div>
                    </div>
                    <div className="flex-1 mx-5 relative">
                      <div className="border-t border-dashed border-neutral-300" />
                      <Ship className="absolute -top-2.5 left-1/2 h-5 w-5 -translate-x-1/2 bg-white px-0.5 text-orange-500" />
                    </div>
                    <div className="text-right">
                      <div style={mono} className="mb-1 text-[9px] tracking-widest text-neutral-400">DESTINATION</div>
                      <div style={serif} className="text-2xl">Durban</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {["Customer", "Order", "Invoice & payment", "Tracking reference", "Shipment progress", "Customer updates", "Clearance progress", "Final delivery"].map((chip) => (
                      <div key={chip} className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2.5 ring-1 ring-neutral-200">
                        <Check className="h-3 w-3 shrink-0 text-emerald-600" strokeWidth={3} />
                        <span className="text-[12px] text-neutral-700">{chip}</span>
                      </div>
                    ))}
                  </div>
                  <p style={mono} className="mt-5 text-center text-[9px] tracking-[0.2em] text-neutral-400">
                    ONE JOB · EVERYTHING CONNECTED
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === CUSTOMER TRACKING - contrasting warm section === */}
      <section className="py-24 sm:py-32 px-4 sm:px-8 bg-orange-50/50 border-y border-orange-100">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-x-8 gap-y-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease }}
            className="col-span-12 lg:col-span-5"
          >
            <p style={mono} className="text-[11px] tracking-[0.3em] text-orange-500 mb-4">CUSTOMER TRACKING</p>
            <h2 style={serif} className="text-4xl sm:text-5xl lg:text-[3.4rem] tracking-tight leading-[1.0] mb-6">
              Give your customers <em className="not-italic text-orange-500">visibility</em>, without giving them your internal workspace.
            </h2>
            <p className="text-base sm:text-lg text-neutral-600 leading-relaxed max-w-md mb-8">
              Every job gets a public, branded tracking page. Reference number, current
              stage, full status timeline. Fewer "where is my shipment?" calls.
            </p>
            <div className="inline-flex items-center gap-3 rounded-xl bg-white ring-1 ring-neutral-200 px-4 py-3 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div>
                <div style={mono} className="text-[10px] tracking-widest text-neutral-500">TRACKING · #OLY-2094</div>
                <div className="text-[13px] font-medium text-neutral-900 mt-0.5">In transit · MSC Kalina · ETA 14 Sep</div>
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease }}
            className="col-span-12 lg:col-span-7"
          >
            <img
              src={notifyTracking}
              alt="Customer receiving a tracking link and following her shipment on her phone"
              className="w-full rounded-[1.75rem] ring-1 ring-neutral-200 shadow-[0_40px_100px_-60px_rgba(0,0,0,0.35)]"
              loading="lazy"
            />
          </motion.div>
        </div>
      </section>

      {/* === STARTER PLAN - editorial layout === */}
      <section className="py-24 sm:py-32 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-x-8 gap-y-14 items-start">
          <div className="col-span-12 lg:col-span-5 lg:sticky lg:top-28">
            <p style={mono} className="text-[11px] tracking-[0.3em] text-neutral-400 mb-4">STARTER PLAN</p>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease }}
              style={serif}
              className="text-4xl sm:text-5xl lg:text-[3.4rem] tracking-tight leading-[1.0] mb-6"
            >
              Start with the freight workflow you need <em className="not-italic text-orange-500">today</em>.
            </motion.h2>
            <p className="text-base text-neutral-600 leading-relaxed max-w-md mb-10">
              The essential operating system for a growing freight business, without
              the complexity of enterprise forwarding software.
            </p>
            <motion.img
              src={freightVisual}
              alt="Freight container truck with order management screen and pallet"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.9, ease }}
              className="w-full max-w-sm drop-shadow-[0_30px_60px_rgba(0,0,0,0.15)]"
              loading="lazy"
            />
          </div>

          <div className="col-span-12 lg:col-span-6 lg:col-start-7">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.9, ease }}
              className="rounded-[1.75rem] bg-white ring-1 ring-neutral-200 shadow-[0_40px_100px_-60px_rgba(0,0,0,0.3)] overflow-hidden"
            >
              <div className="px-7 sm:px-9 pt-8 pb-7 border-b border-neutral-100 flex items-end justify-between gap-4">
                <div>
                  <p style={mono} className="text-[10px] tracking-[0.25em] text-neutral-400 mb-3">{plans.free.name.toUpperCase()} · AVAILABLE NOW</p>
                  <div className="flex items-baseline gap-2">
                    <span style={serif} className="text-5xl sm:text-6xl tracking-tight">R{plans.free.price}</span>
                    <span className="text-neutral-500">/ month</span>
                  </div>
                </div>
                <span style={mono} className="hidden sm:inline-block text-[9px] tracking-[0.2em] px-3 py-1.5 rounded-full bg-emerald-50 ring-1 ring-emerald-200 text-emerald-700">
                  MONTHLY
                </span>
              </div>
              <div className="px-7 sm:px-9 py-7">
                <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3.5">
                  {FREE_PLAN_ITEMS.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-neutral-700">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login?mode=signup"
                  className="group mt-8 inline-flex w-full sm:w-auto items-center justify-between gap-6 px-7 py-4 bg-neutral-900 text-white rounded-full hover:bg-black transition-colors"
                >
                  <span className="text-sm font-medium tracking-wide">Choose Starter</span>
                  <span className="w-9 h-9 rounded-full bg-orange-400 text-neutral-900 flex items-center justify-center group-hover:rotate-45 transition-transform duration-500">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* === FINAL CTA === */}
      <section className="relative px-4 sm:px-8 pt-6 pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto">
          <div className="relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-neutral-100">
            <img
              src={ctaWarehouse}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover object-[70%_center]"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-white/20" aria-hidden />
            <div className="absolute -bottom-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-orange-500/15 blur-3xl" aria-hidden />

            <div className="relative px-6 sm:px-12 lg:px-16 py-20 sm:py-28 grid grid-cols-12 gap-8 items-end">
              <div className="col-span-12 lg:col-span-8">
                <motion.h2
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, ease }}
                  style={serif}
                  className="break-words text-4xl leading-[0.95] tracking-[-0.02em] text-neutral-950 sm:text-6xl md:text-7xl"
                >
                  Try <em className="text-orange-400 not-italic">Olyxee</em> on your next order.
                </motion.h2>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.15, ease }}
                className="col-span-12 lg:col-span-4 flex flex-col gap-4 relative z-10"
              >
                <Link
                  href="/login?mode=signup"
                  className="group inline-flex items-center justify-between gap-6 rounded-full bg-neutral-900 px-7 py-5 text-white transition-colors hover:bg-neutral-800"
                >
                  <span className="text-sm font-medium tracking-wide">Create your workspace</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-400 text-neutral-900 transition-transform duration-500 group-hover:rotate-45">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </Link>
                <Link
                  href="/login"
                  style={mono}
                  className="pl-2 text-[11px] tracking-[0.22em] text-neutral-600 transition-colors hover:text-neutral-950"
                >
                  → SIGN IN
                </Link>
                <p style={mono} className="pl-2 text-[10px] leading-relaxed tracking-[0.18em] text-neutral-500">
                  BUILT FOR CROSS-BORDER FREIGHT TEAMS · STARTER R{plans.free.price}/MONTH
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* === FOOTER === */}
      <SiteFooter />
    </div>
  );
};

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
          <p style={mono} className="text-[10px] tracking-[0.25em] text-neutral-400 mb-4">
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
          <p style={mono} className="text-[10px] tracking-[0.25em] text-neutral-400 mb-4">
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
          <p style={mono} className="text-[10px] tracking-[0.25em] text-neutral-400 mb-4">
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
        <p style={mono} className="text-[11px] tracking-[0.2em] text-neutral-400">
          © {new Date().getFullYear()} OLYXEE LOGISTICS · ALL RIGHTS RESERVED
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-x-6 gap-y-2">
          <a
            href="https://olyxee.com"
            target="_blank"
            rel="noopener noreferrer"
            style={mono}
            className="group text-[11px] tracking-[0.2em] text-neutral-400 hover:text-neutral-900 transition-colors inline-flex items-center gap-1.5"
          >
            DEVELOPED BY OLYXEE
            <ArrowUpRight className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
          </a>
          <p style={mono} className="text-[11px] tracking-[0.2em] text-neutral-400">
            MADE IN SOUTH AFRICA
          </p>
        </div>
      </div>
    </div>
  </footer>
);

export default Landing;
