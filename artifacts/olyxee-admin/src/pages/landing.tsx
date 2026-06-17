import { FC, useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Bot, Route, Sparkles, BarChart3, Mail, Phone } from "lucide-react";
import defaultIcon from "@assets/Courier_Loop_Orange_Icon_1779935120486.png";
import navLogo from "@assets/1_1780016152275.png";
import orderLoopLogo from "@assets/Order-Loop_trans_1781656242217.png";
import heroPhoto from "@assets/image_1780017592401.png";
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

const ease = [0.25, 0.1, 0.25, 1] as const;

const statusWords = [
  "CONFIRMED",
  "IN PROGRESS",
  "READY",
  "OUT FOR DELIVERY",
  "COLLECTED",
  "DELIVERED",
  "NOTIFIED",
];

const serif = { fontFamily: '"Lora", ui-serif, Georgia, serif', fontWeight: 500 };
const mono = { fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace' };
const sans = '"Inter", system-ui, -apple-system, sans-serif';

const DashboardMock: FC = () => (
  <div className="w-full h-full bg-gradient-to-br from-neutral-50 to-neutral-100 p-8">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-orange-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
      </div>
      <div style={mono} className="text-[10px] tracking-widest text-neutral-400">ORDERS · LIVE</div>
    </div>
    <div className="grid grid-cols-4 gap-3 mb-6">
      {[
        ["TOTAL", "248"],
        ["IN TRANSIT", "37"],
        ["DELIVERED", "194"],
        ["DELAYED", "2"],
      ].map(([label, val]) => (
        <div key={label} className="bg-white rounded-xl p-4 ring-1 ring-neutral-200">
          <div style={mono} className="text-[9px] tracking-widest text-neutral-400">{label}</div>
          <div style={serif} className="text-3xl mt-1 text-neutral-900">{val}</div>
        </div>
      ))}
    </div>
    <div className="space-y-2">
      {[
        ["#OLY-1042", "Sarah K.", "OUT FOR DELIVERY", "bg-orange-100 text-orange-800"],
        ["#OLY-1041", "Marcus T.", "DELIVERED", "bg-emerald-100 text-emerald-800"],
        ["#OLY-1040", "Priya R.", "PACKED", "bg-sky-100 text-sky-800"],
        ["#OLY-1039", "James L.", "CONFIRMED", "bg-neutral-100 text-neutral-800"],
        ["#OLY-1038", "Ada O.", "DELIVERED", "bg-emerald-100 text-emerald-800"],
      ].map(([id, name, status, color]) => (
        <div key={id} className="bg-white rounded-lg px-4 py-3 ring-1 ring-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div style={mono} className="text-xs text-neutral-500">{id}</div>
            <div className="text-sm text-neutral-900">{name}</div>
          </div>
          <span style={mono} className={`text-[9px] tracking-widest px-2 py-1 rounded ${color}`}>{status}</span>
        </div>
      ))}
    </div>
  </div>
);

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
    body: "An AI ops partner that reads your inbox, schedules pickups, replies to customers, and flags exceptions — so you can run the business instead of running after it.",
    bullets: ["Auto-respond to WISMO emails", "Re-book missed pickups", "Daily ops briefing at 7am"],
    accent: "from-orange-400 to-orange-500",
  },
  {
    tag: "Q4 · 2026",
    icon: Route,
    title: "Route optimizer",
    body: "Drag a day's worth of orders onto the map and Order Loop builds the fastest multi-stop route for every team member — accounting for traffic, time windows, and vehicle load.",
    bullets: ["Multi-stop sequencing", "Live traffic & ETA recalc", "Driver mobile handoff"],
    accent: "from-sky-400 to-indigo-500",
  },
  {
    tag: "2027",
    icon: BarChart3,
    title: "Insights & forecasting",
    body: "Know which orders are slipping, which team members are crushing it, and what next week's volume will look like — before it lands.",
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
      <section className="relative pt-32 sm:pt-40 pb-12 sm:pb-20 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-12 gap-y-10 gap-x-6 items-end">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease }}
              style={serif}
              className="col-span-12 lg:col-span-9 text-[2.75rem] sm:text-[5rem] md:text-[6.5rem] lg:text-[8rem] xl:text-[9rem] tracking-[-0.03em] leading-[0.9] break-words"
            >
              The
              <br />
              <em className="text-orange-500 italic">Loop.</em>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease }}
              className="col-span-12 lg:col-span-3 lg:pb-6"
            >
              <p className="text-lg sm:text-xl text-neutral-700 leading-relaxed max-w-sm">
                Order Loop helps businesses manage customer orders, update statuses, and keep customers informed — all from one simple dashboard.
              </p>
            </motion.div>
          </div>

          {/* Hero visual + CTA row */}
          <div className="mt-16 sm:mt-24 grid grid-cols-12 gap-6 sm:gap-8 items-end">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.4, ease }}
              className="col-span-12 lg:col-span-8 relative aspect-[4/3] sm:aspect-[16/10]"
            >
              <img src={heroPhoto} alt="Isometric illustration of the Order Loop order operations network" className="absolute inset-0 w-full h-full object-contain" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.55, ease }}
              className="col-span-12 lg:col-span-4 flex flex-col gap-4 lg:pb-8"
            >
              <Link
                href="/login?mode=signup"
                className="group inline-flex items-center justify-between gap-6 px-7 py-5 bg-neutral-900 text-white rounded-full hover:bg-black transition-colors"
              >
                <span className="text-sm font-medium tracking-wide">Start Managing Orders</span>
                <span className="w-9 h-9 rounded-full bg-orange-400 text-neutral-900 flex items-center justify-center group-hover:rotate-45 transition-transform duration-500">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </Link>
              <Link
                href="/login"
                style={mono}
                className="text-[11px] tracking-[0.22em] text-neutral-400 hover:text-neutral-900 transition-colors pl-2"
              >
                → OPEN DASHBOARD
              </Link>
            </motion.div>
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
              One order, one form. Customer, items, address, done.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease }}
            className="col-span-12 lg:col-span-8 relative aspect-[4/3] rounded-[2rem] overflow-hidden ring-1 ring-neutral-200/80 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.3)]"
          >
            <DashboardMock />
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
              From first measurement to final fitting — tracked.
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
              Dry cleaners, bakeries, tailors, repair shops, local stores, delivery teams, warehouses — if you take customer orders, Order Loop keeps every one of them on track.
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
                  — A QUESTION YOU WON'T HEAR ANYMORE
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
          <Link href="/" className="inline-flex items-center">
            <img
              src={orderLoopLogo}
              alt="Order Loop"
              className="h-9 w-auto object-contain"
            />
          </Link>
          <p className="mt-5 text-sm text-neutral-600 leading-relaxed max-w-sm">
            Order Loop is the order-tracking and customer-notification layer
            for businesses and operations teams — from confirmed to delivered, in one loop.
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
