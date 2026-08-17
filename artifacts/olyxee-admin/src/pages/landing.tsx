import { FC, ReactNode, useEffect, useState } from "react";
import notifyTracking from "@assets/image_1783706089743.png";
import heroPerson from "@assets/3dc14bbb-237d-46ca-961d-b793583b5cd1-removebg-preview_1781657363854.png";
import olyxeeLogo from "@assets/Order-Loop-LOGO_1786979611771.png";
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
  Plane,
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
  Truck,
  Stamp,
} from "lucide-react";

const ease = [0.25, 0.1, 0.25, 1] as const;

const statusWords = [
  "ORDER CREATED",
  "INVOICE SENT",
  "PAYMENT CONFIRMED",
  "VESSEL DEPARTED",
  "ARRIVED AT PORT",
  "CLEARANCE IN PROGRESS",
  "OUT FOR DELIVERY",
  "JOB COMPLETE",
];

const serif = { fontFamily: '"Newsreader", ui-serif, Georgia, serif', fontWeight: 500 };
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
  { label: "Order created", meta: "Shanghai → Durban · sea freight", done: true },
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

// ─── Problem section content ─────────────────────────────────────────────────
const PAIN_POINTS = [
  {
    icon: Search,
    title: "Scattered information",
    body: "Stop searching across spreadsheets, emails, WhatsApp messages, and files.",
  },
  {
    icon: MessagesSquare,
    title: "Manual customer updates",
    body: "Keep customers informed without repeatedly sending the same shipment information.",
  },
  {
    icon: Layers,
    title: "Too much coordination",
    body: "Keep orders, payments, shipment progress, and delivery connected.",
  },
];

// ─── Workflow chain ──────────────────────────────────────────────────────────
const WORKFLOW_STEPS = [
  { label: "Customer request", icon: MessagesSquare },
  { label: "Order", icon: Package },
  { label: "Invoice & payment", icon: FileText },
  { label: "Air / Sea shipment", icon: Ship },
  { label: "Customs & clearance", icon: Stamp },
  { label: "Delivery / Collection", icon: Truck },
  { label: "Job complete", icon: Check },
];

// ─── Free product value ──────────────────────────────────────────────────────
const FREE_VALUE = [
  { title: "Manage customers and orders", body: "Keep every customer and shipment organized." },
  { title: "Invoice and confirm payments", body: "Keep the commercial side connected to the job." },
  { title: "Manage air and sea shipments", body: "Follow the shipment journey from origin to delivery or collection." },
  { title: "Keep customers informed", body: "Give customers branded shipment tracking and automated email updates." },
  { title: "Keep a clear history", body: "See what happened on the job without searching through old messages and files." },
];


// ─── Free plan list ──────────────────────────────────────────────────────────
const FREE_PLAN_ITEMS = [
  "Customer management",
  "Order management",
  "Invoicing",
  "Payment confirmation",
  "Air & sea shipment workflows",
  "Shipment tracking",
  "Branded customer tracking",
  "Delivery & collection",
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
    body: "Surface delays, missing documents, payment issues, and shipment exceptions.",
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

// ─── Ops intelligence preview ────────────────────────────────────────────────
const ATTENTION_ITEMS = [
  { label: "Missing document", ref: "#OLY-2087" },
  { label: "ETA changed", ref: "#OLY-2091" },
  { label: "Payment blocking shipment", ref: "#OLY-2079" },
  { label: "Cargo overdue", ref: "#OLY-2064" },
  { label: "Clearance action required", ref: "#OLY-2095" },
  { label: "Delivery overdue", ref: "#OLY-2058" },
];

const OpsPreviewMock: FC = () => (
  <div className="rounded-[1.75rem] bg-neutral-950 ring-1 ring-neutral-800 p-6 sm:p-8 shadow-[0_50px_120px_-50px_rgba(0,0,0,0.6)]">
    <div className="flex items-center justify-between mb-6">
      <div style={mono} className="text-[10px] tracking-widest text-white/50">OPERATIONS · TODAY</div>
      <div style={mono} className="text-[9px] tracking-widest px-2 py-1 rounded-full bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30">
        COMING WITH SCALE
      </div>
    </div>

    <div className="grid grid-cols-3 gap-3 mb-6">
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
        <div style={serif} className="text-3xl sm:text-4xl text-white">68</div>
        <div style={mono} className="text-[8px] tracking-widest text-white/40 mt-1.5">ACTIVE JOBS</div>
      </div>
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
        <div style={serif} className="text-3xl sm:text-4xl text-emerald-400">59</div>
        <div style={mono} className="text-[8px] tracking-widest text-white/40 mt-1.5">PROGRESSING NORMALLY</div>
      </div>
      <div className="rounded-xl bg-orange-500/10 ring-1 ring-orange-500/30 p-4">
        <div style={serif} className="text-3xl sm:text-4xl text-orange-400">9</div>
        <div style={mono} className="text-[8px] tracking-widest text-orange-400/70 mt-1.5">NEED ATTENTION</div>
      </div>
    </div>

    <div className="space-y-2">
      {ATTENTION_ITEMS.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: i * 0.08, ease }}
          className="flex items-center gap-3 rounded-xl bg-white/[0.03] ring-1 ring-white/10 px-4 py-2.5"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span className="text-[13px] text-white/85">{item.label}</span>
          <span style={mono} className="ml-auto text-[9px] tracking-wider text-white/35">{item.ref}</span>
        </motion.div>
      ))}
    </div>
  </div>
);

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
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-12 gap-y-16 gap-x-8 items-center">
            <div className="col-span-12 lg:col-span-6">
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
                className="text-[2.6rem] sm:text-[3.6rem] lg:text-[4rem] xl:text-[4.5rem] leading-[0.95] tracking-[-0.03em]"
              >
                Run your freight forwarding operation in{" "}
                <span className="relative inline-block">
                  <em className="italic text-orange-500">one place</em>
                  <svg
                    aria-hidden
                    className="absolute left-0 -bottom-2 w-full"
                    height="14"
                    viewBox="0 0 140 14"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path d="M3 9 C 34 3, 70 3, 102 8 S 136 11, 137 6" stroke="#f97316" strokeWidth="3.5" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="text-neutral-300">.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.35, ease }}
                className="mt-8 text-base sm:text-lg text-neutral-600 leading-relaxed max-w-lg"
              >
                Customers, orders, invoices, payments, and shipments — all in one place.
                No more spreadsheets, email threads, and WhatsApp.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5, ease }}
                className="mt-9 flex flex-wrap items-center gap-5"
              >
                <Link
                  href="/login?mode=signup"
                  className="group inline-flex items-center justify-between gap-6 px-7 py-4 bg-neutral-900 text-white rounded-full hover:bg-black transition-colors"
                >
                  <span className="text-sm font-medium tracking-wide">Start Free</span>
                  <span className="w-9 h-9 rounded-full bg-orange-400 text-neutral-900 flex items-center justify-center group-hover:rotate-45 transition-transform duration-500">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </Link>
                <Link
                  href="/login"
                  style={mono}
                  className="text-[11px] tracking-[0.22em] text-neutral-500 border-b border-neutral-300 pb-0.5 hover:text-neutral-900 hover:border-neutral-900 transition-colors"
                >
                  SIGN IN
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.65, ease }}
                className="mt-8 space-y-1.5"
              >
                <p style={mono} className="text-[11px] tracking-[0.18em] text-neutral-400">
                  R0/MONTH · NO CREDIT CARD REQUIRED
                </p>
              </motion.div>
            </div>

            <div className="col-span-12 lg:col-span-6">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.35, ease }}
              >
                <HeroJobCard />
              </motion.div>
            </div>
          </div>
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
              Freight forwarding has enough <em className="italic text-orange-500">moving parts</em> already.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: 0.1, ease }}
              className="text-base sm:text-lg text-neutral-500 font-light leading-relaxed max-w-2xl"
            >
              One shipment touches many people, documents, and payments. Keep it all together.
            </motion.p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {PAIN_POINTS.map((p, i) => {
              const Icon = p.icon;
              return (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.7, delay: i * 0.12, ease }}
                  className="rounded-[1.5rem] bg-neutral-50 ring-1 ring-neutral-200 p-7"
                >
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-100 text-orange-600 mb-5">
                    <Icon className="w-5 h-5" />
                  </span>
                  <h3 style={serif} className="text-2xl tracking-tight mb-2.5">{p.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{p.body}</p>
                </motion.div>
              );
            })}
          </div>
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
              Built around the way <em className="italic text-orange-400">freight forwarders</em> work.
            </motion.h2>
            <p className="text-base sm:text-lg text-white/55 font-light leading-relaxed max-w-2xl">
              One job. Seven steps. Nothing gets lost.
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
                  className={`relative rounded-2xl p-5 ring-1 flex flex-col gap-4 min-h-[9.5rem] ${
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
              Start with the work your team already does <em className="italic text-orange-500">every day</em>.
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
                  One China shipment. One clear <em className="italic text-orange-400">workflow</em>.
                </motion.h2>
                <p className="text-base sm:text-lg text-white/55 font-light leading-relaxed max-w-lg">
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
            <p style={mono} className="text-[11px] tracking-[0.3em] text-neutral-400 mb-4">CUSTOMER TRACKING</p>
            <h2 style={serif} className="text-4xl sm:text-6xl tracking-tight leading-[0.95] mb-6">
              Customers track it <em className="italic text-orange-500">themselves</em>.
            </h2>
            <p className="text-base sm:text-lg text-neutral-500 font-light leading-relaxed max-w-md">
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
              Start using Olyxee Logistics for <em className="italic text-orange-500">free</em>.
            </motion.h2>
            <div className="flex items-baseline gap-2 mb-8">
              <span style={serif} className="text-5xl sm:text-6xl tracking-tight">R0</span>
              <span className="text-neutral-500">/ month</span>
            </div>
            <Link
              href="/login?mode=signup"
              className="group inline-flex items-center justify-between gap-6 px-7 py-4 bg-neutral-900 text-white rounded-full hover:bg-black transition-colors"
            >
              <span className="text-sm font-medium tracking-wide">Create Free Account</span>
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
      <section className="py-24 sm:py-32 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mb-14">
            <p style={mono} className="text-[11px] tracking-[0.3em] text-orange-500 mb-4 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> SCALE + ORGNI
            </p>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, ease }}
              style={serif}
              className="text-4xl sm:text-6xl tracking-tight leading-[0.95] mb-6"
            >
              Let <em className="italic text-orange-500">Orgni</em> handle the routine work.
            </motion.h2>
          </div>

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
                  className="relative rounded-[1.5rem] bg-neutral-50 ring-1 ring-neutral-200 p-7"
                >
                  <span
                    style={mono}
                    className="absolute top-5 right-5 text-[8px] tracking-[0.2em] px-2 py-1 rounded-full bg-orange-100 text-orange-700"
                  >
                    COMING WITH SCALE
                  </span>
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-100 text-orange-600 mb-5">
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

      {/* === OPERATIONAL INTELLIGENCE PREVIEW === */}
      <section className="py-24 sm:py-32 px-4 sm:px-8 bg-neutral-950 text-white">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-x-8 gap-y-14 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease }}
            className="col-span-12 lg:col-span-5"
          >
            <p style={mono} className="text-[11px] tracking-[0.3em] text-orange-400 mb-4 flex flex-wrap items-center gap-3">
              OPERATIONAL INTELLIGENCE
              <span className="text-[9px] tracking-[0.2em] px-2 py-1 rounded-full bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30">
                COMING WITH SCALE
              </span>
            </p>
            <h2 style={serif} className="text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[0.95] mb-6">
              Stop checking <em className="italic text-orange-400">every shipment</em> manually.
            </h2>
            <p className="text-base sm:text-lg text-white/55 font-light leading-relaxed max-w-lg">
              Orgni will watch your jobs and flag only what needs attention.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease }}
            className="col-span-12 lg:col-span-7"
          >
            <OpsPreviewMock />
          </motion.div>
        </div>
      </section>

      {/* === SCALE PRICING === */}
      <section className="py-24 sm:py-32 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease }}
            style={serif}
            className="text-4xl sm:text-6xl tracking-tight leading-[0.98] mb-14"
          >
            More shipments. <em className="italic text-orange-500">Less admin</em>.
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, delay: 0.1, ease }}
            className="mx-auto max-w-lg rounded-[1.75rem] bg-white ring-1 ring-neutral-200 shadow-[0_40px_100px_-60px_rgba(0,0,0,0.35)] p-8 sm:p-10 text-left"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 style={serif} className="text-3xl tracking-tight">Scale</h3>
              <span style={mono} className="text-[9px] tracking-[0.2em] px-2.5 py-1 rounded-full bg-orange-100 text-orange-700">
                ORGNI · COMING WITH SCALE
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span style={serif} className="text-5xl tracking-tight">R1,499</span>
              <span className="text-neutral-500">/ company / month</span>
            </div>
            <p className="mt-3 text-sm font-medium text-orange-600">Billing starts 30 September 2026.</p>
            <p className="mt-5 text-sm text-neutral-500 leading-relaxed">
              Everything in Free, plus Orgni Intelligence.
            </p>
            <Link
              href="/upgrade"
              className="group mt-8 inline-flex w-full items-center justify-between gap-6 px-7 py-4 bg-neutral-900 text-white rounded-full hover:bg-black transition-colors"
            >
              <span className="text-sm font-medium tracking-wide">Join Scale</span>
              <span className="w-9 h-9 rounded-full bg-orange-400 text-neutral-900 flex items-center justify-center group-hover:rotate-45 transition-transform duration-500">
                <ArrowUpRight className="w-4 h-4" />
              </span>
            </Link>
          </motion.div>
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
                  Run your next freight shipment with <em className="text-orange-400 italic">Olyxee Logistics.</em>
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.1, ease }}
                  className="mt-6 text-base sm:text-lg text-white/55 font-light leading-relaxed max-w-xl"
                >
                  Everything about every job, in one place.
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
