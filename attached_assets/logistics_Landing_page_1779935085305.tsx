import { FC } from "react";
import Image from "next/image";
import SEO from "../../components/SEO";
import Header from "../../components/header";
import Footer from "../../components/footer";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const ease = [0.25, 0.1, 0.25, 1] as const;

const statusWords = [
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "OUT FOR DELIVERY",
  "DELIVERED",
  "NOTIFIED",
];

const Logistics: FC = () => {
  return (
    <div className="min-h-screen bg-white text-neutral-900 overflow-x-hidden">
      <SEO
        title="Olyxee Logistics, Keep every customer in the loop"
        description="Olyxee Logistics, the live system that lets anyone who sells send clean order status updates from confirmed to delivered."
        path="/solutions/logistics"
        keywords={[
          "Olyxee Logistics",
          "order status updates",
          "customer notifications",
          "order tracking",
          "ecommerce logistics",
        ]}
      />
      <div className="grain" />
      <Header />

      {/* === HERO === */}
      <section className="relative pt-32 sm:pt-40 pb-12 sm:pb-20 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-12 gap-y-10 gap-x-6 items-end">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease }}
              className="col-span-12 lg:col-span-9 font-serif text-[2.75rem] sm:text-[5rem] md:text-[6.5rem] lg:text-[8rem] xl:text-[9rem] tracking-[-0.03em] leading-[0.9] break-words"
            >
              The
              <br />
              <em className="text-amber-500 not-italic font-serif italic">Loop.</em>
            </motion.h1>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease }}
              className="col-span-12 lg:col-span-3 lg:pb-6"
            >
              <p className="text-lg sm:text-xl text-neutral-700 leading-relaxed max-w-sm">
                Order status updates that keep every customer in the loop, from confirmed to delivered.
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
              <Image
                src="/images/logistics/hero-iso.png"
                alt="Olyxee Logistics, a closed loop of trucks, packages, tracking, and delivery"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 66vw"
                className="object-contain"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.55, ease }}
              className="col-span-12 lg:col-span-4 flex flex-col gap-4 lg:pb-8"
            >
              <a
                href="https://logistics.olyxee.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-between gap-6 px-7 py-5 bg-neutral-900 text-white rounded-full hover:bg-black transition-colors"
              >
                <span className="text-sm font-medium tracking-wide">Try Olyxee Logistics</span>
                <span className="w-9 h-9 rounded-full bg-amber-400 text-neutral-900 flex items-center justify-center group-hover:rotate-45 transition-transform duration-500">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </a>
              <a
                href="https://logistics.olyxee.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] tracking-[0.22em] text-neutral-400 hover:text-neutral-900 transition-colors pl-2"
              >
                → LOGISTICS.OLYXEE.COM
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* === MARQUEE === */}
      <section
        aria-hidden="true"
        className="relative border-y border-neutral-200 bg-neutral-950 text-white overflow-hidden py-5"
      >
        <div className="flex whitespace-nowrap animate-[marquee_38s_linear_infinite]">
          {[...Array(3)].map((_, loop) => (
            <div key={loop} className="flex shrink-0 items-center">
              {statusWords.map((word, i) => (
                <span
                  key={`${loop}-${i}`}
                  className="flex items-center font-serif italic text-3xl sm:text-5xl tracking-tight px-8"
                >
                  {word}
                  <span className="ml-8 inline-block w-2 h-2 rounded-full bg-amber-400" />
                </span>
              ))}
            </div>
          ))}
        </div>
        <style jsx>{`
          @keyframes marquee {
            from {
              transform: translateX(0);
            }
            to {
              transform: translateX(-33.3333%);
            }
          }
        `}</style>
      </section>

      {/* === CHAPTER 01, CREATE === */}
      <section className="py-24 sm:py-32 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease }}
            className="col-span-12 lg:col-span-4 lg:sticky lg:top-32"
          >
            <p className="font-mono text-[11px] tracking-[0.3em] text-neutral-400 mb-4">
              CH. 01
            </p>
            <h2 className="font-serif text-5xl sm:text-7xl tracking-tight leading-[0.95] mb-6">
              Create.
            </h2>
            <p className="text-base text-neutral-500 font-light leading-relaxed max-w-sm">
              One order, one form. Customer, items, address, done.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease }}
            className="col-span-12 lg:col-span-8 relative rounded-[2rem] overflow-hidden ring-1 ring-neutral-200/80 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.3)]"
          >
            <Image
              src="/images/logistics/orders-dashboard.png"
              alt="Olyxee Logistics orders dashboard"
              width={1600}
              height={1200}
              className="w-full h-auto object-cover"
            />
          </motion.div>
        </div>
      </section>

      {/* === CHAPTER 02, TRACK === */}
      <section className="py-24 sm:py-32 px-4 sm:px-8 bg-neutral-950 text-white">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease }}
            className="col-span-12 lg:col-span-8 order-2 lg:order-1 relative rounded-[2rem] overflow-hidden ring-1 ring-white/10 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.5)]"
          >
            <Image
              src="/images/logistics/tracking-map.png"
              alt="Live tracking map for an order in transit"
              width={1600}
              height={1000}
              className="w-full h-auto object-cover"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease }}
            className="col-span-12 lg:col-span-4 order-1 lg:order-2 lg:pl-8"
          >
            <p className="font-mono text-[11px] tracking-[0.3em] text-white/40 mb-4">
              CH. 02
            </p>
            <h2 className="font-serif text-5xl sm:text-7xl tracking-tight leading-[0.95] mb-6">
              Track.
            </h2>
            <p className="text-base text-white/60 font-light leading-relaxed max-w-sm">
              A clean tracking link your customer can open any time. No app, no account.
            </p>
          </motion.div>
        </div>
      </section>

      {/* === CHAPTER 03, NOTIFY === */}
      <section className="py-24 sm:py-32 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease }}
            className="col-span-12 lg:col-span-5 flex flex-col justify-between"
          >
            <div>
              <p className="font-mono text-[11px] tracking-[0.3em] text-neutral-400 mb-4">
                CH. 03
              </p>
              <h2 className="font-serif text-5xl sm:text-7xl tracking-tight leading-[0.95] mb-6">
                Notify.
              </h2>
              <p className="text-base text-neutral-500 font-light leading-relaxed max-w-sm">
                Every status change sends a branded SMS and email automatically. Silence the "where is my order?" inbox.
              </p>
            </div>

            <div className="relative mt-10 lg:mt-0 aspect-[4/5] rounded-[2rem] overflow-hidden">
              <Image
                src="/images/logistics/seller-support.jpg"
                alt="Seller in a stockroom answering a call"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover grayscale contrast-[1.05]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <p className="absolute bottom-6 left-6 right-6 font-serif italic text-2xl text-white leading-tight">
                "Where is my order?"
                <span className="block not-italic font-mono text-[10px] tracking-[0.2em] text-white/60 mt-3">
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
            <Image
              src="/images/logistics/delivery-handoff.jpg"
              alt="Customer accepting a package at her doorstep"
              fill
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8 text-white">
              <p className="font-mono text-[11px] tracking-[0.3em] text-amber-400 mb-3">
                DELIVERED · 14:02
              </p>
              <p className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight max-w-md">
                The only surprise at the door is the package.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* === CLOSING === */}
      <section className="relative px-4 sm:px-8 pt-20 sm:pt-28 pb-20 sm:pb-28">
        <div className="max-w-7xl mx-auto">
          <div className="relative rounded-[2rem] overflow-hidden">
            <Image
              src="/images/logistics/close-loop-bg.png"
              alt=""
              width={2048}
              height={680}
              className="absolute inset-0 w-full h-full object-cover"
              priority={false}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20" />

            <div className="relative px-6 sm:px-12 lg:px-16 py-20 sm:py-32 lg:py-40 grid grid-cols-12 gap-8 items-end">
              <motion.h2
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease }}
                className="col-span-12 lg:col-span-8 font-serif text-white text-4xl sm:text-6xl md:text-7xl lg:text-[6.5rem] tracking-[-0.02em] leading-[0.95] break-words"
              >
                Close the
                <br />
                <em className="text-amber-400 italic">loop today.</em>
              </motion.h2>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.15, ease }}
                className="col-span-12 lg:col-span-4 flex flex-col gap-3"
              >
                <a
                  href="https://logistics.olyxee.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-between gap-6 px-7 py-5 bg-white text-neutral-900 rounded-full hover:bg-amber-400 transition-colors"
                >
                  <span className="text-sm font-medium tracking-wide">Open the app</span>
                  <span className="w-9 h-9 rounded-full bg-neutral-900 text-white flex items-center justify-center group-hover:rotate-45 transition-transform duration-500">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                </a>
                <Link
                  href="/contact?subject=Olyxee%20Logistics%20%E2%80%94%20Inquiry"
                  className="font-mono text-[11px] tracking-[0.22em] text-white/70 hover:text-white transition-colors pl-2"
                >
                  → TALK TO THE TEAM
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Logistics;
