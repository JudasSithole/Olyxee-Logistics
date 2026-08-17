import { FC, ReactNode, useEffect, useState } from "react";
import notifyTracking from "@assets/image_1783706089743.png";
import heroPerson from "@assets/3dc14bbb-237d-46ca-961d-b793583b5cd1-removebg-preview_1781657363854.png";
import olyxeeLogo from "@assets/Order-Loop-LOGO_1786979611771.png";
import oldWayQuotes from "@assets/image_1786981204947.png";
import oldWaySpreadsheets from "@assets/image_1786981215190.png";
import oldWayInbox from "@assets/image_1786981225722.png";
import oldWayPaper from "@assets/image_1786981236403.png";

// ─── "The old way" rotating showcase ─────────────────────────────────────────
const OLD_WAY_SLIDES = [
  { img: oldWayQuotes, label: "Quotes in scattered documents", body: "Quotations live in folders, spreadsheets, and templates no one can find." },
  { img: oldWaySpreadsheets, label: "Spreadsheets everywhere", body: "Every shipment tracked in a different sheet, updated by hand." },
  { img: oldWayInbox, label: "The inbox is the system", body: "Bookings, bills of lading, and arrival notices buried in email threads." },
  { img: oldWayPaper, label: "Paper trails and re-checking", body: "Carrier documents checked line by line, job by job." },
];

const OldWayShowcase: FC = () => {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((a) => (a + 1) % OLD_WAY_SLIDES.length), 4500);
    return () => clearInterval(t);
  }, [paused]);

  const slide = OLD_WAY_SLIDES[active];

  return (
    <div
      className="grid lg:grid-cols-[minmax(0,20rem)_1fr] gap-6 lg:gap-10 items-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
        {OLD_WAY_SLIDES.map((s, i) => (
          <button
            key={s.label}
            onClick={() => setActive(i)}
            className={`relative text-left shrink-0 lg:shrink rounded-2xl px-5 py-4 ring-1 transition-all ${
              i === active
                ? "bg-neutral-950 text-white ring-neutral-950"
                : "bg-white text-neutral-700 ring-neutral-200 hover:ring-neutral-400"
            }`}
          >
            <span className="flex items-center gap-3">
              <span
                style={mono}
                className={`text-[10px] tracking-widest ${i === active ? "text-orange-400" : "text-neutral-400"}`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-medium leading-snug">{s.label}</span>
            </span>
            {i === active && !paused && (
              <motion.span
                key={`bar-${active}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 4.5, ease: "linear" }}
                className="absolute left-5 right-5 bottom-2 h-0.5 origin-left rounded-full bg-orange-500/70"
              />
            )}
          </button>
        ))}
      </div>

      <div className="relative rounded-[1.75rem] overflow-hidden ring-1 ring-neutral-200 bg-neutral-100 aspect-[16/10]">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease }}
            className="absolute inset-0"
          >
            <img src={slide.img} alt={slide.label} className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-neutral-950/80 to-transparent pt-16 pb-5 px-6">
              <p className="text-white text-sm sm:text-base font-medium">{slide.body}</p>
            </div>
          </motion.div>
        </AnimatePresence>
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
  Sparkles,
  Ship,
  FileText,
  AlertTriangle,
  Bell,
  PhoneCall,
  ClipboardList,
  Search,
  MessagesSquare,
  Layers,
  Package,
} from "lucide-react";

const ease = [0.25, 0.1, 0.25, 1] as const;

const statusWords = [
  "QUOTE ACCEPTED",
  "ORDER CONFIRMED",
  "RECEIVED FROM SUPPLIER",
  "EXPORT CUSTOMS CLEARED",
  "IN TRANSIT",
  "IMPORT CUSTOMS CLEARANCE",
  "OUT FOR DELIVERY",
  "DELIVERED",
];

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

const CreateOrderMock: FC = () => {
  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [created, setCreated] = useState<DemoOrder[]>([]);

  const cust = DEMO_CUSTOMERS[idx];
  const detail = DEMO_DETAILS[idx];
  const reff = DEMO_REFS[idx];

  useEffect(() => {
    const t = setTimeout(() => {
      if (step >= 5) {
        setIdx((i) => (i + 1) % DEMO_CUSTOMERS.length);
        setStep(0);
      } else {
        setStep((s) => s + 1);
      }
    }, STEP_DELAYS[step]);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (step === 5) {
      setCreated((c) => [{ ref: reff, customer: cust, details: detail, key: Date.now() }, ...c].slice(0, 3));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const screenProps = { step, cust, custIdx: idx, detail, reff, created };

  return (
    <>
      <div className="lg:hidden">
        <PhoneFrame>
          <OrderScreen variant="mobile" {...screenProps} />
        </PhoneFrame>
      </div>
      <div className="hidden lg:block">
        <ScreenFrame>
          <OrderScreen variant="desktop" {...screenProps} />
        </ScreenFrame>
      </div>
    </>
  );
};

// ─── Hero visual: one freight job, fully connected ──────────────────────────
const JOB_TIMELINE = [
  { label: "Quote accepted · order created", meta: "Shanghai → Durban · sea freight", done: true },
  { label: "Invoice sent · payment confirmed", meta: "R48,200 · paid", done: true },
  { label: "Vessel departed", meta: "MSC Kalina · ETA 14 Sep", done: true },
  { label: "Clearance in progress", meta: "Documents organised in the job", done: false },
  { label: "Delivery to customer", meta: "Johannesburg · pending", done: false },
];

const HeroJobCard: FC = () => (
  <div className="relative">
    <div className="rounded-[1.75rem] bg-neutral-950 p-6 sm:p-8 ring-1 ring-neutral-800 shadow-[0_50px_120px_-50px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between mb-6">
        <div style={mono} className="text-[10px] tracking-widest text-white/50">JOB · #OLY-2094</div>
        <div style={mono} className="text-[9px] tracking-widest text-orange-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          IN TRANSIT
        </div>
      </div>

      <div className="flex items-center gap-3 mb-7">
        <span className="w-9 h-9 rounded-full bg-orange-500 text-white text-[11px] font-medium flex items-center justify-center shrink-0">TN</span>
        <div className="min-w-0">
          <div className="text-[14px] text-white truncate">Thandi Nkosi · Nkosi Trading</div>
          <div style={mono} className="text-[9px] tracking-widest text-white/40 mt-0.5">CHINA IMPORT · 20FT CONTAINER</div>
        </div>
        <Ship className="ml-auto w-5 h-5 text-white/30 shrink-0" />
      </div>

      <div className="space-y-0">
        {JOB_TIMELINE.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 + i * 0.15, ease }}
            className="flex gap-3.5"
          >
            <div className="flex flex-col items-center">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  s.done ? "bg-emerald-500" : "bg-white/10 ring-1 ring-white/20"
                }`}
              >
                {s.done ? (
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                )}
              </span>
              {i < JOB_TIMELINE.length - 1 && <span className="w-px flex-1 bg-white/10 my-1" />}
            </div>
            <div className="pb-4 min-w-0">
              <div className={`text-[13px] leading-tight ${s.done ? "text-white" : "text-white/50"}`}>{s.label}</div>
              <div style={mono} className="text-[9px] tracking-wider text-white/35 mt-1 truncate">{s.meta}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.4, ease }}
        className="mt-2 rounded-xl bg-white/5 ring-1 ring-white/10 px-4 py-3 flex items-center gap-3"
      >
        <Mail className="w-4 h-4 text-orange-400 shrink-0" />
        <div className="min-w-0">
          <div className="text-[12px] text-white/85 truncate">Customer notified automatically</div>
          <div style={mono} className="text-[8px] tracking-widest text-white/35 mt-0.5">BRANDED EMAIL · LIVE TRACKING LINK</div>
        </div>
      </motion.div>
    </div>
  </div>
);

// ─── Workflow chain ──────────────────────────────────────────────────────────
const WORKFLOW_STEPS = [
  { label: "Add your customer", body: "Customer and their freight activity in one place.", icon: User },
  { label: "Send a quote", body: "Customer accepts — you convert it to an order.", icon: MessagesSquare },
  { label: "Add freight details", body: "Air or sea, origin, destination, cargo, references.", icon: Package },
  { label: "Update shipment stages", body: "Your team moves the job through each stage.", icon: Ship },
  { label: "Customer tracks it", body: "Public branded tracking page — no account needed.", icon: MapPin },
  { label: "Invoice & payment status", body: "Know which jobs are paid and which are outstanding.", icon: FileText },
  { label: "Job history kept", body: "Statuses, documents, and records stay together.", icon: Check },
];

// ─── Free product value ──────────────────────────────────────────────────────
const FREE_VALUE = [
  { title: "Customers, leads, and quotes" },
  { title: "Convert accepted quotes to orders" },
  { title: "Air and sea freight orders" },
  { title: "Shipment status history and documents" },
  { title: "Public customer tracking and email updates" },
  { title: "Invoices and payment status" },
];


// ─── Free plan list ──────────────────────────────────────────────────────────
const FREE_PLAN_ITEMS = [
  "Customer management",
  "Leads / CRM",
  "Quotes with accept or reject",
  "Convert accepted quotes to orders",
  "Air and sea freight orders",
  "Cargo and supplier references",
  "Shipment status history",
  "Public customer tracking",
  "Basic invoices and payment status",
  "Documents",
  "Dashboard and reporting",
  "Up to 50 automated emails per month",
];

// ─── Orgni future value ──────────────────────────────────────────────────────
const ORGNI_VALUE = [
  {
    icon: Bell,
    title: "Know what needs attention",
    body: "See which jobs are moving normally and which need action.",
  },
  {
    icon: MessagesSquare,
    title: "Reduce follow-ups",
    body: "Help chase missing information and routine outstanding actions.",
  },
  {
    icon: AlertTriangle,
    title: "Catch problems earlier",
    body: "Surface delays, deadline changes, and shipment exceptions.",
  },
  {
    icon: ClipboardList,
    title: "Make clearance easier to manage",
    body: "Keep clearance progress, required information, and next actions organized.",
  },
  {
    icon: Mail,
    title: "Keep customers informed",
    body: "Coordinate customer communication from the same job.",
  },
  {
    icon: PhoneCall,
    title: "Handle routine customer questions",
    body: "Future call-center capabilities will use the actual shipment information inside Olyxee Logistics.",
  },
];

const Landing: FC = () => {
  return (
    <div className="min-h-screen bg-white text-neutral-900 overflow-x-hidden" style={{ fontFamily: sans }}>
      {/* === HEADER === */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-white/80 border-b border-neutral-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src={olyxeeLogo} alt="Olyxee Logistics logo" className="h-8 w-8 object-contain" />
            <span className="text-lg font-bold tracking-tight sm:text-xl">Olyxee Logistics</span>
          </Link>
          <nav className="flex items-center gap-0.5 sm:gap-1">
            <Link href="/upgrade" className="hidden sm:inline-block text-sm font-medium px-3 py-2 rounded-full text-neutral-600 hover:text-neutral-900 transition-colors">
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
        <div className="relative max-w-5xl mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease }}
            style={mono}
            className="text-[11px] tracking-[0.3em] text-orange-500 mb-6"
          >
            FOR FREIGHT FORWARDERS &amp; CROSS-BORDER OPERATORS
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease }}
            style={serif}
            className="text-[2.6rem] sm:text-[3.8rem] lg:text-[4.4rem] leading-[1.02] tracking-[-0.03em]"
          >
            The platform that powers
            <br className="hidden sm:block" />{" "}
            <span className="text-orange-500">global logistics</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease }}
            className="mt-7 text-base sm:text-lg text-neutral-600 leading-relaxed max-w-xl mx-auto"
          >
            Customers, quotes, orders, shipment progress, payments, and customer
            tracking — connected in one place.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease }}
            className="mt-10 flex flex-wrap items-center justify-center gap-5"
          >
            <Link
              href="/login?mode=signup"
              className="group inline-flex items-center justify-between gap-6 px-8 py-4 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors shadow-[0_20px_50px_-20px_rgba(249,115,22,0.6)]"
            >
              <span className="text-sm font-medium tracking-wide">Start Free</span>
              <ArrowUpRight className="w-4 h-4 group-hover:rotate-45 transition-transform duration-500" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center px-8 py-4 rounded-full bg-white ring-1 ring-neutral-200 text-sm font-medium text-neutral-800 hover:ring-neutral-400 transition-all"
            >
              Sign In
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.65, ease }}
            style={mono}
            className="mt-7 text-[11px] tracking-[0.18em] text-neutral-400"
          >
            R0/MONTH · NO CREDIT CARD REQUIRED
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.55, ease }}
            className="mt-16 text-left max-w-4xl mx-auto"
          >
            <HeroJobCard />
          </motion.div>
        </div>
      </section>

      {/* === MARQUEE === */}
      <section
        aria-hidden="true"
        className="relative border-y border-neutral-200 bg-neutral-950 text-white overflow-hidden py-5"
      >
        <div className="flex whitespace-nowrap animate-[olyxee-marquee_38s_linear_infinite]">
          {[...Array(3)].map((_, loop) => (
            <div key={loop} className="flex shrink-0 items-center">
              {statusWords.map((word, i) => (
                <span
                  key={`${loop}-${i}`}
                  style={serif}
                  className="flex items-center italic text-3xl sm:text-5xl tracking-tight px-8"
                >
                  {word}
                  <span className="ml-8 inline-block w-2 h-2 rounded-full bg-orange-400" />
                </span>
              ))}
            </div>
          ))}
        </div>
        <style>{`
          @keyframes olyxee-marquee {
            from { transform: translateX(0); }
            to { transform: translateX(-33.3333%); }
          }
        `}</style>
      </section>

      {/* === PROBLEM === */}
      <section className="py-24 sm:py-32 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-16">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease }}
              style={mono}
              className="text-[11px] tracking-[0.3em] text-neutral-400 mb-4"
            >
              THE PROBLEM
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease }}
              style={serif}
              className="text-4xl sm:text-6xl tracking-tight leading-[0.95] mb-6"
            >
              Freight forwarding has enough <em className="not-italic text-orange-500">moving parts</em> already.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: 0.1, ease }}
              className="text-base sm:text-lg text-neutral-600 leading-relaxed max-w-2xl"
            >
              One shipment touches many people, documents, and payments. Keep it all together.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease }}
          >
            <OldWayShowcase />
          </motion.div>
        </div>
      </section>

      {/* === WORKFLOW === */}
      <section className="py-24 sm:py-32 px-4 sm:px-8 bg-neutral-950 text-white">
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
            <p className="text-base sm:text-lg text-white/75 leading-relaxed max-w-2xl">
              From quote to delivery — your team manages every step in Olyxee Logistics.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {WORKFLOW_STEPS.map((step, i) => {
              const Icon = step.icon;
              const isLast = i === WORKFLOW_STEPS.length - 1;
              return (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: i * 0.09, ease }}
                  className={`relative rounded-2xl p-5 ring-1 flex flex-col gap-4 min-h-[11rem] ${
                    isLast
                      ? "bg-orange-500 ring-orange-400 text-white"
                      : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.08] transition-colors"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${
                        isLast ? "bg-white/20 text-white" : "bg-orange-500/15 text-orange-400"
                      }`}
                    >
                      <Icon className="w-[18px] h-[18px]" strokeWidth={isLast ? 3 : 2} />
                    </span>
                    <span
                      style={mono}
                      className={`text-[10px] tracking-widest ${isLast ? "text-white/70" : "text-white/30"}`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="mt-auto">
                    <p className={`text-[13px] leading-snug font-medium ${isLast ? "text-white" : "text-white/85"}`}>
                      {step.label}
                    </p>
                    <p className={`mt-1.5 text-[11px] leading-snug ${isLast ? "text-white/80" : "text-white/45"}`}>
                      {step.body}
                    </p>
                  </div>
                  {!isLast && (
                    <ArrowRight className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400/60 z-10" />
                  )}
                </motion.div>
              );
            })}
          </div>

        </div>
      </section>

      {/* === CURRENT FREE PRODUCT === */}
      <section className="py-24 sm:py-32 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-x-8 gap-y-14 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease }}
            className="col-span-12 lg:col-span-5"
          >
            <p style={mono} className="text-[11px] tracking-[0.3em] text-neutral-400 mb-4">FREE TODAY</p>
            <h2 style={serif} className="text-4xl sm:text-6xl tracking-tight leading-[0.95] mb-8">
              Start with the work your team already does <em className="not-italic text-orange-500">every day</em>.
            </h2>
            <ul className="space-y-4">
              {FREE_VALUE.map((v) => (
                <li key={v.title} className="flex items-center gap-3.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </span>
                  <p className="text-[15px] font-medium text-neutral-900">{v.title}</p>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease }}
            className="col-span-12 lg:col-span-7 relative flex items-center justify-center"
          >
            <CreateOrderMock />
          </motion.div>
        </div>
      </section>

      {/* === REAL-WORLD EXAMPLE === */}
      <section className="py-24 sm:py-32 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="relative rounded-[2rem] bg-neutral-950 text-white overflow-hidden">
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-orange-500/10 blur-3xl" aria-hidden />
            <div className="relative grid grid-cols-12 gap-8 p-8 sm:p-14 lg:p-16 items-center">
              <div className="col-span-12 lg:col-span-6">
                <p style={mono} className="text-[11px] tracking-[0.3em] text-orange-400 mb-4">A REAL JOB</p>
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
                <p className="text-base sm:text-lg text-white/75 leading-relaxed max-w-lg">
                  From the customer's request to final delivery — everything about the job lives together.
                </p>
              </div>
              <div className="col-span-12 lg:col-span-6">
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-7">
                    <div>
                      <div style={mono} className="text-[9px] tracking-widest text-white/40 mb-1">ORIGIN</div>
                      <div style={serif} className="text-2xl">Shanghai</div>
                    </div>
                    <div className="flex-1 mx-5 relative">
                      <div className="border-t border-dashed border-white/25" />
                      <Ship className="absolute left-1/2 -translate-x-1/2 -top-2.5 w-5 h-5 text-orange-400 bg-neutral-950 px-0.5" />
                    </div>
                    <div className="text-right">
                      <div style={mono} className="text-[9px] tracking-widest text-white/40 mb-1">DESTINATION</div>
                      <div style={serif} className="text-2xl">Durban</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {["Customer", "Order", "Invoice & payment", "Tracking reference", "Shipment progress", "Customer updates", "Clearance progress", "Final delivery"].map((chip) => (
                      <div key={chip} className="flex items-center gap-2 rounded-lg bg-white/[0.04] ring-1 ring-white/10 px-3 py-2.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" strokeWidth={3} />
                        <span className="text-[12px] text-white/80">{chip}</span>
                      </div>
                    ))}
                  </div>
                  <p style={mono} className="mt-5 text-[9px] tracking-[0.2em] text-white/35 text-center">
                    ONE JOB · EVERYTHING CONNECTED
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === CUSTOMER TRACKING === */}
      <section className="py-24 sm:py-32 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-x-8 gap-y-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease }}
            className="col-span-12 lg:col-span-5"
          >
            <p style={mono} className="text-[11px] tracking-[0.3em] text-neutral-400 mb-4">CUSTOMERS</p>
            <h2 style={serif} className="text-4xl sm:text-6xl tracking-tight leading-[0.95] mb-6">
              Designed for the people who <em className="not-italic text-orange-500">move the world</em>.
            </h2>
            <p className="text-base sm:text-lg text-neutral-600 leading-relaxed max-w-md">
              Every job gets a tracking link. Fewer "where is my shipment?" calls.
            </p>
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

      {/* === FREE PLAN === */}
      <section className="py-24 sm:py-32 px-4 sm:px-8 bg-neutral-50 border-y border-neutral-200">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-x-8 gap-y-12 items-center">
          <div className="col-span-12 lg:col-span-6">
            <p style={mono} className="text-[11px] tracking-[0.3em] text-neutral-400 mb-4">FREE PLAN</p>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease }}
              style={serif}
              className="text-4xl sm:text-6xl tracking-tight leading-[0.95] mb-6"
            >
              Start using Olyxee Logistics for <em className="not-italic text-orange-500">free</em>.
            </motion.h2>
            <div className="flex items-baseline gap-2 mb-8">
              <span style={serif} className="text-5xl sm:text-6xl tracking-tight">R0</span>
              <span className="text-neutral-500">/ month</span>
            </div>
            <Link
              href="/login?mode=signup"
              className="group inline-flex items-center justify-between gap-6 px-7 py-4 bg-neutral-900 text-white rounded-full hover:bg-black transition-colors"
            >
              <span className="text-sm font-medium tracking-wide">Start Free</span>
              <span className="w-9 h-9 rounded-full bg-orange-400 text-neutral-900 flex items-center justify-center group-hover:rotate-45 transition-transform duration-500">
                <ArrowUpRight className="w-4 h-4" />
              </span>
            </Link>
            <p className="mt-5 text-sm font-medium text-neutral-700">No credit card required.</p>
          </div>

          <div className="col-span-12 lg:col-span-6">
            <div className="rounded-[1.75rem] bg-white ring-1 ring-neutral-200 p-7 sm:p-9 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.25)]">
              <p style={mono} className="text-[10px] tracking-[0.25em] text-neutral-400 mb-6">EVERYTHING INCLUDED</p>
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
            </div>
          </div>
        </div>
      </section>

      {/* === SCALE + ORGNI === */}
      <section className="py-24 sm:py-32 px-4 sm:px-8 bg-gradient-to-b from-white via-orange-50/60 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p style={mono} className="text-[11px] tracking-[0.3em] text-orange-500 mb-4 flex items-center justify-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> SCALE + ORGNI
            </p>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease }}
              style={serif}
              className="text-4xl sm:text-6xl tracking-tight leading-[0.98]"
            >
              Today your team runs it. Next, <em className="not-italic text-orange-500">Orgni</em> runs alongside.
            </motion.h2>
          </div>

          {/* Today vs Next split */}
          <div className="grid lg:grid-cols-[1fr_auto_1fr] items-stretch gap-6 lg:gap-4 mb-16">
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease }}
              className="rounded-[1.75rem] bg-white ring-1 ring-neutral-200 p-8 sm:p-10"
            >
              <p style={mono} className="text-[10px] tracking-[0.3em] text-neutral-400 mb-4">TODAY</p>
              <h3 style={serif} className="text-2xl sm:text-3xl tracking-tight mb-3">
                Your team manages the freight workflow.
              </h3>
              <p className="text-[15px] text-neutral-600 leading-relaxed">
                Olyxee Logistics is the operational foundation — quotes, orders, shipment
                stages, tracking, and payments, managed by your people.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 ring-1 ring-emerald-200 px-4 py-2">
                <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={3} />
                <span style={mono} className="text-[10px] tracking-[0.2em] text-emerald-700">AVAILABLE NOW · FREE</span>
              </div>
            </motion.div>

            <div className="hidden lg:flex flex-col items-center justify-center px-2">
              <span className="w-12 h-12 rounded-full bg-neutral-950 text-orange-400 flex items-center justify-center shadow-lg">
                <ArrowRight className="w-5 h-5" />
              </span>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: 0.1, ease }}
              className="relative overflow-hidden rounded-[1.75rem] bg-neutral-950 text-white p-8 sm:p-10"
            >
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-orange-500/20 blur-3xl" aria-hidden />
              <p style={mono} className="relative text-[10px] tracking-[0.3em] text-orange-400 mb-4">NEXT</p>
              <h3 style={serif} className="relative text-2xl sm:text-3xl tracking-tight mb-3">
                Orgni reduces the work around it.
              </h3>
              <p className="relative text-[15px] text-white/70 leading-relaxed">
                Orgni Intelligence is being built to take over the checking, chasing, and
                routine coordination around each job as you grow.
              </p>
              <div className="relative mt-6 inline-flex items-center gap-2 rounded-full bg-orange-500/15 ring-1 ring-orange-500/30 px-4 py-2">
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                <span style={mono} className="text-[10px] tracking-[0.2em] text-orange-300">COMING WITH SCALE</span>
              </div>
            </motion.div>
          </div>

          {/* Orgni capabilities */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ORGNI_VALUE.map((v, i) => {
              const Icon = v.icon;
              return (
                <motion.div
                  key={v.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.7, delay: i * 0.08, ease }}
                  className="group relative rounded-[1.5rem] bg-white ring-1 ring-neutral-200 hover:ring-orange-300 hover:shadow-[0_20px_60px_-40px_rgba(249,115,22,0.5)] transition-all p-7"
                >
                  <span
                    style={mono}
                    className="absolute top-5 right-5 text-[8px] tracking-[0.2em] px-2 py-1 rounded-full bg-orange-100 text-orange-700"
                  >
                    COMING WITH SCALE
                  </span>
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-100 text-orange-600 mb-5 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                    <Icon className="w-5 h-5" />
                  </span>
                  <h3 style={serif} className="text-2xl tracking-tight mb-2.5 pr-2">{v.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{v.body}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* === FINAL CTA === */}
      <section className="relative px-4 sm:px-8 pt-6 pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto">
          <div className="relative rounded-[2rem] overflow-hidden bg-neutral-950">
            <div className="absolute -bottom-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-orange-500/15 blur-3xl" aria-hidden />

            <div className="relative px-6 sm:px-12 lg:px-16 py-20 sm:py-28 grid grid-cols-12 gap-8 items-end">
              <div className="col-span-12 lg:col-span-8">
                <motion.h2
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, ease }}
                  style={serif}
                  className="text-white text-4xl sm:text-6xl md:text-7xl tracking-[-0.02em] leading-[0.95] break-words"
                >
                  Try <em className="text-orange-400 not-italic">Olyxee Logistics</em> on your next freight order.
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.1, ease }}
                  className="mt-6 text-base sm:text-lg text-white/75 leading-relaxed max-w-xl"
                >
                  Create a customer, send a quote, turn it into an order, and manage the
                  shipment through to delivery.
                </motion.p>
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
                  className="group inline-flex items-center justify-between gap-6 px-7 py-5 bg-white text-neutral-900 rounded-full hover:bg-orange-400 transition-colors"
                >
                  <span className="text-sm font-medium tracking-wide">Start Free</span>
                  <span className="w-9 h-9 rounded-full bg-neutral-900 text-white flex items-center justify-center group-hover:rotate-45 transition-transform duration-500">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </Link>
                <Link
                  href="/login"
                  style={mono}
                  className="text-[11px] tracking-[0.22em] text-white/70 hover:text-white transition-colors pl-2"
                >
                  → SIGN IN
                </Link>
                <p style={mono} className="text-[10px] tracking-[0.18em] text-white/40 pl-2 leading-relaxed">
                  BUILT FOR FREIGHT FORWARDERS · R0/MONTH · NO CREDIT CARD REQUIRED
                </p>
                <img
                  src={heroPerson}
                  alt=""
                  aria-hidden
                  className="hidden lg:block self-end -mb-[7rem] mt-4 w-60 xl:w-72 opacity-90 pointer-events-none"
                  loading="lazy"
                />
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
            Start free <ArrowUpRight className="w-4 h-4" />
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
