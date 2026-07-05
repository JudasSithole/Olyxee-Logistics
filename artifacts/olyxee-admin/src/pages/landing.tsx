import { FC, ReactNode, useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Bot, Route, Sparkles, BarChart3, Mail, Phone, Check, User, ChevronDown, MapPin, Loader2 } from "lucide-react";
import defaultIcon from "@assets/Courier_Loop_Orange_Icon_1779935120486.png";
import navLogo from "@assets/1_1780016152275.png";
import orderLoopLogo from "@assets/Order-Loop_trans_1781656242217.png";
import heroPhoto from "@assets/image_1780017592401.png";
import heroPerson from "@assets/3dc14bbb-237d-46ca-961d-b793583b5cd1-removebg-preview_1781657363854.png";
import scanPhoto from "@assets/image_1779935779272.png";
import trackPhoto from "@assets/image_1779935881868.png";
import handoffPhoto from "@assets/image_1779935903875.png";
import unboxingPhoto from "@assets/image_1779935870578.png";
import closingPhoto from "@assets/image_1780016743161.png";
import dryCleanerPhoto from "@assets/image_1781655294134.png";
import tailorPhoto from "@assets/image_1781655334535.png";
import bakeryPhoto from "@assets/image_1781655422517.png";
import warehousePhoto from "@assets/image_1781655528508.png";
import repairPhoto from "@assets/image_1781655658557.png";
import { LaunchCountdown } from "@/components/launch-countdown";
import { plans, LAUNCH_LABEL, type PlanId } from "@/lib/launch";

const ease = [0.25, 0.1, 0.25, 1] as const;

const statusWords = [
  "ORDER PLACED",
  "CONFIRMED",
  "IN PROGRESS",
  "READY FOR COLLECTION",
  "NOTIFIED",
  "PICKED UP",
  "COLLECTED",
];

const serif = { fontFamily: '"Lora", ui-serif, Georgia, serif', fontWeight: 500 };
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
  { name: "Sarah Klein", initials: "SK", phone: "+44 7700 900321", address: "14 Camden High St, London" },
  { name: "Marcus Tan", initials: "MT", phone: "+44 7700 900654", address: "8 Maple Ave, Manchester" },
  { name: "Priya Raman", initials: "PR", phone: "+44 7700 900987", address: "22 Oak Lane, Leeds" },
];

const DEMO_DETAILS = [
  "2× Wool coat · 1× Silk dress · express",
  "1× Birthday cake (large) · collect Fri 3pm",
  "3× Shirt alteration · slim fit",
];

const DEMO_REFS = ["#OLY-1043", "#OLY-1044", "#OLY-1045"];

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

      {/* Order details */}
      <div>
        <div style={mono} className="text-[8px] tracking-widest text-neutral-400 mb-1">ORDER DETAILS</div>
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
                Typing order details
                <Caret />
              </span>
            ) : (
              <span className="text-[13px] text-neutral-300">Add order details…</span>
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
      <div style={mono} className="text-[9px] tracking-widest text-neutral-400 mb-2 px-1">LIVE ORDERS</div>
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
          <div className="text-[11px] text-neutral-300 px-1 py-6 text-center">Orders appear here as you create them.</div>
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

const TrackingMapMock: FC = () => (
  <div className="w-full h-full bg-neutral-900 relative overflow-hidden">
    <img src={warehousePhoto} alt="Warehouse team member managing a customer order on a call" className="absolute inset-0 w-full h-full object-cover opacity-90" />
    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/55 to-neutral-950/35" />
    <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
      <div style={mono} className="text-[10px] tracking-widest text-white/70">TRACKING · #OLY-1042</div>
      <div style={mono} className="text-[10px] tracking-widest text-orange-400">ETA 14:42</div>
    </div>
    <div className="absolute bottom-6 left-6 right-6 bg-white/10 backdrop-blur-md rounded-xl p-4 ring-1 ring-white/15">
      <div style={mono} className="text-[9px] tracking-widest text-white/60 mb-1">CURRENT STATUS</div>
      <div style={serif} className="text-2xl text-white italic">Out for delivery.</div>
    </div>
  </div>
);

type UpcomingItem = {
  tag: string;
  icon: typeof Bot;
  title: string;
  body: string;
  bullets: string[];
  accent: string;
};

const UPCOMING: UpcomingItem[] = [
  {
    tag: "Q3 · 2026",
    icon: Bot,
    title: "Autonomous business runner",
    body: "An AI ops partner that reads your inbox, schedules pickups, replies to customers, and flags exceptions - so you can run the business instead of running after it.",
    bullets: ["Auto-respond to WISMO emails", "Re-book missed pickups", "Daily ops briefing at 7am"],
    accent: "from-orange-400 to-orange-500",
  },
  {
    tag: "Q4 · 2026",
    icon: Route,
    title: "Route optimizer",
    body: "Drag a day's worth of orders onto the map and Order Loop builds the fastest multi-stop route for every team member - accounting for traffic, time windows, and vehicle load.",
    bullets: ["Multi-stop sequencing", "Live traffic & ETA recalc", "Driver mobile handoff"],
    accent: "from-sky-400 to-indigo-500",
  },
  {
    tag: "2027",
    icon: BarChart3,
    title: "Insights & forecasting",
    body: "Know which orders are slipping, which team members are crushing it, and what next week's volume will look like - before it lands.",
    bullets: ["SLA scorecards", "Volume forecasts", "Cost-per-order breakdowns"],
    accent: "from-emerald-400 to-teal-500",
  },
];

const UpcomingSection: FC = () => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => (i + 1) % UPCOMING.length), 6000);
    return () => window.clearInterval(id);
  }, []);
  const item = UPCOMING[index];
  const Icon = item.icon;

  return (
    <section id="upcoming" className="relative px-4 sm:px-8 py-24 sm:py-32 bg-neutral-50 border-y border-neutral-200">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
          <div>
            <p style={mono} className="text-[11px] tracking-[0.3em] text-orange-500 mb-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> ON THE ROADMAP
            </p>
            <h2 style={serif} className="text-4xl sm:text-6xl tracking-tight leading-[0.95]">
              What's <em className="italic text-orange-500">next.</em>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {UPCOMING.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show roadmap item ${i + 1}`}
                className="h-1 rounded-full transition-all"
                style={{
                  width: i === index ? 32 : 14,
                  backgroundColor: i === index ? "rgb(23 23 23)" : "rgb(212 212 212)",
                }}
              />
            ))}
          </div>
        </div>

        <div className="relative rounded-[2rem] bg-white ring-1 ring-neutral-200 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.2)] overflow-hidden min-h-[420px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5, ease }}
              className="grid grid-cols-12 gap-8 p-8 sm:p-12"
            >
              <div className="col-span-12 lg:col-span-7">
                <div className="flex items-center gap-3 mb-6">
                  <span className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${item.accent} text-white shadow-lg`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span style={mono} className="text-[10px] tracking-[0.3em] text-neutral-400">{item.tag}</span>
                  <span style={mono} className="text-[10px] tracking-[0.25em] px-2 py-1 rounded-full bg-orange-100 text-orange-700">PLANNED</span>
                </div>
                <h3 style={serif} className="text-3xl sm:text-5xl tracking-tight leading-tight mb-5">{item.title}</h3>
                <p className="text-base sm:text-lg text-neutral-600 leading-relaxed max-w-xl mb-8">{item.body}</p>
                <ul className="space-y-3">
                  {item.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-3 text-sm text-neutral-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="col-span-12 lg:col-span-5 relative">
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${item.accent} opacity-10`} />
                <div className="relative h-full min-h-[240px] rounded-2xl ring-1 ring-neutral-200 bg-gradient-to-br from-neutral-50 to-white flex items-center justify-center overflow-hidden">
                  <Icon className="w-40 h-40 text-neutral-200" strokeWidth={1} />
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                    <span style={mono} className="text-[9px] tracking-[0.25em] text-neutral-400">PREVIEW</span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                      <span style={mono} className="text-[9px] tracking-[0.25em] text-neutral-400">IN BUILD</span>
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

const Landing: FC = () => {
  return (
    <div className="min-h-screen bg-white text-neutral-900 overflow-x-hidden" style={{ fontFamily: sans }}>
      {/* === HEADER === */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-white/80 border-b border-neutral-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img
              src={orderLoopLogo}
              alt="Order Loop"
              className="h-8 sm:h-10 w-auto object-contain"
            />
          </Link>
          <Link href="/login" className="text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-full bg-neutral-900 text-white hover:bg-black transition-colors">
            Log In
          </Link>
        </div>
      </header>

      {/* === HERO === */}
      <section className="relative pt-32 sm:pt-40 pb-12 sm:pb-20 px-4 sm:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-12 gap-y-16 gap-x-8 items-start">
            {/* Headline block */}
            <div className="col-span-12 lg:col-span-7">
              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.2, ease }}
                style={serif}
                className="text-[3rem] sm:text-[4.75rem] lg:text-[6rem] xl:text-[6.75rem] leading-[0.85] tracking-[-0.035em]"
              >
                Keep customers
                <br />
                in the{" "}
                <span className="relative inline-block">
                  <em className="italic text-orange-500">loop</em>
                  <svg
                    aria-hidden
                    className="absolute left-0 -bottom-3 w-full"
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
                className="mt-10 text-base sm:text-lg text-neutral-600 leading-relaxed max-w-md"
              >
                Manage orders and keep customers updated, all from one simple dashboard.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5, ease }}
                className="mt-9 flex items-center gap-7"
              >
                <Link
                  href="/login?mode=signup"
                  className="group inline-flex items-center justify-between gap-6 px-7 py-4 bg-neutral-900 text-white rounded-full hover:bg-black transition-colors"
                >
                  <span className="text-sm font-medium tracking-wide">Start Managing Orders</span>
                  <span className="w-9 h-9 rounded-full bg-orange-400 text-neutral-900 flex items-center justify-center group-hover:rotate-45 transition-transform duration-500">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </Link>
                <Link
                  href="/login"
                  style={mono}
                  className="text-[11px] tracking-[0.22em] text-neutral-500 border-b border-neutral-300 pb-0.5 hover:text-neutral-900 hover:border-neutral-900 transition-colors"
                >
                  OPEN DASHBOARD
                </Link>
              </motion.div>
            </div>

            {/* Order ticket rail */}
            <div className="col-span-12 lg:col-span-5">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.3, ease }}
                className="flex items-center gap-4 mb-7"
              >
                <span style={mono} className="text-[11px] tracking-[0.25em] text-orange-500">THE RAIL</span>
                <span className="h-px flex-1 bg-neutral-200" />
              </motion.div>

              <div className="relative space-y-7 sm:px-2">
                {/* the spike the tickets hang from */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-2 bottom-14 w-[3px] rounded-full bg-gradient-to-b from-neutral-500 via-neutral-300 to-transparent"
                />
                {[
                  { ref: "OLY-1042", time: "14:42", name: "Sarah Klein", detail: "2x Wool coat · express", stamp: "READY", tone: "ready", rot: "-1.4deg", barcode: true },
                  { ref: "OLY-1041", time: "14:30", name: "Marcus Tan", detail: "1x Birthday cake · large", stamp: "PREPARING", tone: "prep", rot: "1.1deg", barcode: false },
                  { ref: "OLY-1040", time: "13:58", name: "Priya Raman", detail: "3x Shirt alteration · slim", stamp: "COLLECTED", tone: "done", rot: "-0.6deg", barcode: false },
                ].map((t, i) => {
                  const stampColor =
                    t.tone === "ready"
                      ? "border-orange-500 text-orange-500"
                      : t.tone === "done"
                        ? "border-emerald-500 text-emerald-600"
                        : "border-neutral-400 text-neutral-500";
                  // Resting tilt + a pendulum swing that overshoots and settles,
                  // as if the ticket was just dropped onto the spike and is
                  // swinging from its punch-hole (transform origin = top center).
                  const rest = parseFloat(t.rot);
                  const swingDelay = 0.4 + i * 0.12;
                  return (
                    <motion.div
                      key={t.ref}
                      initial={{ opacity: 0, y: -30, rotate: rest - 11 }}
                      animate={{
                        opacity: t.tone === "done" ? 0.82 : 1,
                        y: 0,
                        rotate: [rest - 11, rest + 6, rest - 4, rest + 2.5, rest - 1.5, rest],
                      }}
                      whileHover={{ rotate: 0, y: -5 }}
                      transition={{
                        opacity: { duration: 0.5, delay: swingDelay, ease },
                        y: { type: "spring", stiffness: 130, damping: 9, delay: swingDelay },
                        rotate: {
                          duration: 1.7,
                          delay: swingDelay,
                          ease: "easeOut",
                          times: [0, 0.24, 0.45, 0.64, 0.82, 1],
                        },
                      }}
                      style={{ transformOrigin: "top center" }}
                      className="group relative bg-[#fdfcf7] border border-neutral-900/90 px-4 pt-6 pb-4 shadow-[0_12px_26px_-14px_rgba(23,23,23,0.5),4px_4px_0_0_rgba(23,23,23,0.06)]"
                    >
                      {/* lined-paper grain */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-[0.05]"
                        style={{
                          background:
                            "repeating-linear-gradient(0deg, rgba(0,0,0,0.55) 0px, rgba(0,0,0,0.55) 1px, transparent 1px, transparent 6px)",
                        }}
                      />
                      {/* spindle punch hole */}
                      <span
                        aria-hidden
                        className="absolute -top-[7px] left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-neutral-100 ring-1 ring-inset ring-neutral-400 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]"
                      />

                      {/* inked rubber stamp */}
                      <span
                        style={mono}
                        className={`absolute right-2.5 top-2 rotate-[7deg] bg-[#fdfcf7] border-2 ${stampColor} rounded-[3px] px-2 py-0.5 text-[9px] font-bold tracking-[0.22em] opacity-90 mix-blend-multiply transition-transform duration-300 group-hover:rotate-[2deg]`}
                      >
                        {t.stamp}
                      </span>

                      {/* receipt caption + tear-off perforation */}
                      <div style={mono} className="relative text-center text-[7px] tracking-[0.45em] text-neutral-400">
                        OLYXEE · ORDER TICKET
                      </div>
                      <div aria-hidden className="relative -mx-4 mt-2 border-t border-dashed border-neutral-300" />

                      {/* header */}
                      <div className="relative flex items-center justify-between pt-2.5">
                        <span style={mono} className="text-[10px] tracking-[0.18em] text-neutral-900">#{t.ref}</span>
                        <span style={mono} className="text-[10px] tracking-[0.18em] text-neutral-400">{t.time}</span>
                      </div>

                      {/* body */}
                      <div style={serif} className="relative mt-3 text-xl text-neutral-900 leading-none">{t.name}</div>
                      <div style={mono} className="relative mt-1.5 text-[11px] text-neutral-500">{t.detail}</div>

                      {/* barcode (featured ticket only) */}
                      {t.barcode && (
                        <div className="relative mt-3">
                          <div aria-hidden className="flex items-end gap-[2px] h-7">
                            {[3, 1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 1, 2, 2, 1, 3, 1].map((w, bi) => (
                              <span key={bi} className="bg-neutral-900 h-full" style={{ width: `${w}px` }} />
                            ))}
                          </div>
                          <div style={mono} className="mt-1 text-center text-[8px] tracking-[0.4em] text-neutral-400">
                            {t.ref.replace("-", "")} · 0042
                          </div>
                        </div>
                      )}

                      {/* bottom perforation + track stub */}
                      <div aria-hidden className="relative -mx-4 mt-4 border-t border-dashed border-neutral-300" />
                      <div style={mono} className="relative mt-2 text-[8px] tracking-[0.22em] text-neutral-400">
                        TRACK · olyxee.com/t/{t.ref.toLowerCase()}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
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

      {/* === CHAPTER 01 · CREATE === */}
      <section id="create" className="py-24 sm:py-32 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease }}
            className="col-span-12 lg:col-span-4 lg:sticky lg:top-32"
          >
            <p style={mono} className="text-[11px] tracking-[0.3em] text-neutral-400 mb-4">CH. 01</p>
            <h2 style={serif} className="text-5xl sm:text-7xl tracking-tight leading-[0.95] mb-6">Create.</h2>
            <p className="text-base text-neutral-500 font-light leading-relaxed max-w-sm">
              Pick a customer and their contact and address fill in automatically. Add the order details, hit create, and it goes live.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease }}
            className="col-span-12 lg:col-span-8 relative flex items-center justify-center"
          >
            <CreateOrderMock />
          </motion.div>
        </div>
      </section>

      {/* === FOR EVERY BUSINESS === */}
      <section id="industries" className="py-24 sm:py-32 px-4 sm:px-8 bg-neutral-50 border-y border-neutral-200">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease }}
            className="col-span-12 lg:col-span-7 relative aspect-[16/10] rounded-[2rem] overflow-hidden ring-1 ring-neutral-200 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.3)]"
          >
            <img src={tailorPhoto} alt="Tailor working on a custom order at the workbench" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <p style={mono} className="absolute top-6 left-6 text-[10px] tracking-[0.3em] text-white/80">ATELIER · ORDER #OLY-1057</p>
            <p style={serif} className="absolute bottom-6 left-6 right-6 italic text-2xl sm:text-3xl text-white leading-tight">
              From first measurement to final fitting - tracked.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease }}
            className="col-span-12 lg:col-span-5 lg:pl-8"
          >
            <p style={mono} className="text-[11px] tracking-[0.3em] text-orange-500 mb-4">FOR EVERY BUSINESS</p>
            <h2 style={serif} className="text-4xl sm:text-6xl tracking-tight leading-[0.95] mb-6">
              One platform,
              <br />
              <em className="italic text-orange-500">every order.</em>
            </h2>
            <p className="text-base text-neutral-500 font-light leading-relaxed max-w-sm">
              Dry cleaners, bakeries, tailors, repair shops, local stores, delivery teams, warehouses - if you take customer orders, Order Loop keeps every one of them on track.
            </p>
          </motion.div>
        </div>
      </section>

      {/* === CHAPTER 02 · TRACK === */}
      <section id="track" className="py-24 sm:py-32 px-4 sm:px-8 bg-neutral-950 text-white">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease }}
            className="col-span-12 lg:col-span-8 order-2 lg:order-1 relative aspect-[16/10] rounded-[2rem] overflow-hidden ring-1 ring-white/10 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.5)]"
          >
            <TrackingMapMock />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease }}
            className="col-span-12 lg:col-span-4 order-1 lg:order-2 lg:pl-8"
          >
            <p style={mono} className="text-[11px] tracking-[0.3em] text-white/40 mb-4">CH. 02</p>
            <h2 style={serif} className="text-5xl sm:text-7xl tracking-tight leading-[0.95] mb-6">Track.</h2>
            <p className="text-base text-white/60 font-light leading-relaxed max-w-sm">
              A clean tracking link your customer can open any time. No app, no account.
            </p>
          </motion.div>
        </div>
      </section>

      {/* === CHAPTER 03 · NOTIFY === */}
      <section id="notify" className="py-24 sm:py-32 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease }}
            className="col-span-12 lg:col-span-5 flex flex-col justify-between gap-10"
          >
            <div>
              <p style={mono} className="text-[11px] tracking-[0.3em] text-neutral-400 mb-4">CH. 03</p>
              <h2 style={serif} className="text-5xl sm:text-7xl tracking-tight leading-[0.95] mb-6">Notify.</h2>
              <p className="text-base text-neutral-500 font-light leading-relaxed max-w-sm">
                Every status change sends a branded SMS and email automatically. Silence the "where is my order?" inbox.
              </p>
            </div>

            <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden">
              <img src={bakeryPhoto} alt="Bakery owner preparing a customer order" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <p style={mono} className="absolute top-6 left-6 text-[10px] tracking-[0.3em] text-white/80">BAKERY · 09:14</p>
              <p style={serif} className="absolute bottom-6 left-6 right-6 italic text-2xl text-white leading-tight">
                "Where is my order?"
                <span style={mono} className="block not-italic text-[10px] tracking-[0.2em] text-white/70 mt-3">
                  - A QUESTION YOU WON'T HEAR ANYMORE
                </span>
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease }}
            className="col-span-12 lg:col-span-7 relative aspect-[4/5] lg:aspect-auto lg:min-h-[640px] rounded-[2rem] overflow-hidden"
          >
            <img src={dryCleanerPhoto} alt="Dry cleaner handing a finished order to a customer" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8 text-white">
              <p style={mono} className="text-[11px] tracking-[0.3em] text-orange-400 mb-3">READY · 14:02</p>
              <p style={serif} className="text-3xl sm:text-4xl tracking-tight leading-tight max-w-md">
                Every order handed over, right on time.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* === CLOSING === */}
      <section className="relative px-4 sm:px-8 pt-20 sm:pt-28 pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto">
          <div className="relative rounded-[2rem] overflow-hidden bg-neutral-900">
            <img src={closingPhoto} alt="Support agent helping a customer over the phone" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30" />

            <div className="relative px-6 sm:px-12 lg:px-16 py-20 sm:py-32 lg:py-40 grid grid-cols-12 gap-8 items-end">
              <motion.h2
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease }}
                style={serif}
                className="col-span-12 lg:col-span-8 text-white text-4xl sm:text-6xl md:text-7xl lg:text-[6.5rem] tracking-[-0.02em] leading-[0.95] break-words"
              >
                Close the
                <br />
                <em className="text-orange-400 italic">loop today.</em>
              </motion.h2>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.15, ease }}
                className="col-span-12 lg:col-span-4 flex flex-col gap-3"
              >
                <Link
                  href="/login"
                  className="group inline-flex items-center justify-between gap-6 px-7 py-5 bg-white text-neutral-900 rounded-full hover:bg-orange-400 transition-colors"
                >
                  <span className="text-sm font-medium tracking-wide">Open Dashboard</span>
                  <span className="w-9 h-9 rounded-full bg-neutral-900 text-white flex items-center justify-center group-hover:rotate-45 transition-transform duration-500">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </Link>
                <Link
                  href="/login"
                  style={mono}
                  className="text-[11px] tracking-[0.22em] text-white/70 hover:text-white transition-colors pl-2"
                >
                  → TALK TO THE TEAM
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* === PRICING === */}
      <PricingSection />

      {/* === FOOTER === */}
      <SiteFooter />
    </div>
  );
};

const PLAN_BLURB: Record<PlanId, string> = {
  beta: "Everything unlimited while we're in beta.",
  free: "Get started and keep your first customers in the loop.",
  pro: "For growing businesses that need more reach and their own branding.",
  business: "Full power: unlimited volume, API access and an automated call centre.",
};

function planFeatures(id: PlanId): string[] {
  const p = plans[id];
  const out: string[] = [];
  out.push(p.customerLimit == null ? "Unlimited customers" : `Up to ${p.customerLimit} customers`);
  out.push(
    p.emailLimit == null
      ? "Unlimited email updates"
      : `${p.emailLimit} email updates / month`,
  );
  if (p.smsLimit && p.smsLimit > 0) out.push(`${p.smsLimit} SMS updates / month`);
  if (p.advancedCustomization) out.push("Advanced customization");
  if (p.removeOlyxeeBranding) out.push("Remove Olyxee branding");
  if (p.apiAccess) out.push("Public API access");
  if (p.automatedCallCentre) out.push("Automated call centre");
  return out;
}

const PRICING_TIERS: PlanId[] = ["free", "pro", "business"];

export const PricingSection: FC = () => (
  <section id="pricing" className="px-4 sm:px-8 py-20 sm:py-28 bg-neutral-50 border-t border-neutral-200">
    <div className="max-w-7xl mx-auto">
      <div className="text-center max-w-2xl mx-auto">
        <p style={mono} className="text-[10px] tracking-[0.25em] text-orange-500 mb-4">
          PRICING
        </p>
        <h2 style={serif} className="text-4xl sm:text-5xl tracking-[-0.03em] text-neutral-900">
          Simple plans for every stage
        </h2>
        <p className="mt-4 text-neutral-600">
          Plans go live on {LAUNCH_LABEL}. Prices in South African Rand (ZAR).
        </p>
        <div className="mt-8 max-w-md mx-auto">
          <LaunchCountdown />
        </div>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {PRICING_TIERS.map((id) => {
          const p = plans[id];
          const highlight = id === "pro";
          return (
            <div
              key={id}
              data-testid={`pricing-${id}`}
              className={`relative flex flex-col rounded-2xl bg-white p-8 ${
                highlight ? "ring-2 ring-orange-500 shadow-lg" : "border border-neutral-200"
              }`}
            >
              {highlight && (
                <span
                  style={mono}
                  className="absolute -top-3 left-8 rounded-full bg-orange-500 px-3 py-1 text-[10px] tracking-[0.15em] text-white"
                >
                  MOST POPULAR
                </span>
              )}
              <h3 style={serif} className="text-2xl text-neutral-900">
                {p.name}
              </h3>
              <p className="mt-2 text-sm text-neutral-600 min-h-[40px]">{PLAN_BLURB[id]}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-neutral-900">
                  {p.price === 0 ? "Free" : `R${p.price}`}
                </span>
                {p.price > 0 && <span className="text-sm text-neutral-500">/month</span>}
              </div>
              <ul className="mt-6 space-y-3 flex-1">
                {planFeatures(id).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-neutral-700">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login?mode=signup"
                className={`mt-8 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition-colors ${
                  highlight
                    ? "bg-neutral-900 text-white hover:bg-black"
                    : "border border-neutral-300 text-neutral-900 hover:bg-neutral-100"
                }`}
              >
                Get started
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

export const SiteFooter: FC = () => (
  <footer className="border-t border-neutral-200 bg-white px-4 sm:px-8 pt-16 pb-10">
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-12 gap-y-12 gap-x-8">
        {/* Brand */}
        <div className="col-span-2 md:col-span-5">
          <Link href="/" className="inline-flex items-center">
            <img
              src={orderLoopLogo}
              alt="Order Loop"
              className="h-9 w-auto object-contain"
            />
          </Link>
          <p className="mt-5 text-sm text-neutral-600 leading-relaxed max-w-sm">
            Order Loop is the order-tracking and customer-notification layer
            for businesses and operations teams - from confirmed to delivered, in one loop.
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
          © {new Date().getFullYear()} ORDER LOOP · ALL RIGHTS RESERVED
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
