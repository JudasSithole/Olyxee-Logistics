import { FC, FormEvent, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Mail, MessageCircle, Phone } from "lucide-react";
import navLogo from "@assets/1_1780016152275.png";
import { SiteFooter } from "@/pages/landing";

const serif = { fontFamily: '"Lora", ui-serif, Georgia, serif', fontWeight: 500 };
const mono = { fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace' };
const sans = '"Inter", system-ui, -apple-system, sans-serif';

const ContactPage: FC = () => {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900" style={{ fontFamily: sans }}>
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-white/80 border-b border-neutral-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src={navLogo} alt="Courier Loop" className="h-7 sm:h-9 w-auto object-contain" />
          </Link>
          <Link href="/login" className="text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-full bg-neutral-900 text-white hover:bg-black transition-colors">
            Sign in
          </Link>
        </div>
      </header>

      <section className="pt-32 sm:pt-40 pb-20 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-10">
          <div className="col-span-12 lg:col-span-5">
            <p style={mono} className="text-[11px] tracking-[0.3em] text-neutral-400 mb-4">GET IN TOUCH</p>
            <h1 style={serif} className="text-5xl sm:text-7xl tracking-tight leading-[0.95] mb-6">
              Let's talk <em className="text-orange-500 italic">logistics.</em>
            </h1>
            <p className="text-lg text-neutral-600 leading-relaxed max-w-md mb-10">
              Whether you're shipping ten orders a day or ten thousand, we'd love to hear how your team works and where Courier Loop can help.
            </p>

            <div className="space-y-5">
              <a href="mailto:scofield@olyxee.com" className="flex items-start gap-4 group">
                <span className="w-10 h-10 rounded-full bg-neutral-100 group-hover:bg-orange-100 flex items-center justify-center transition-colors">
                  <Mail className="w-4 h-4 text-neutral-700" />
                </span>
                <div>
                  <p style={mono} className="text-[10px] tracking-[0.25em] text-neutral-400">EMAIL</p>
                  <p className="text-base text-neutral-900 group-hover:text-orange-600 transition-colors">scofield@olyxee.com</p>
                </div>
              </a>
              <a href="tel:+27712233272" className="flex items-start gap-4 group">
                <span className="w-10 h-10 rounded-full bg-neutral-100 group-hover:bg-orange-100 flex items-center justify-center transition-colors">
                  <Phone className="w-4 h-4 text-neutral-700" />
                </span>
                <div>
                  <p style={mono} className="text-[10px] tracking-[0.25em] text-neutral-400">PHONE</p>
                  <p className="text-base text-neutral-900 group-hover:text-orange-600 transition-colors">+27 71 223 3272</p>
                </div>
              </a>
              <div className="flex items-start gap-4">
                <span className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-neutral-700" />
                </span>
                <div>
                  <p style={mono} className="text-[10px] tracking-[0.25em] text-neutral-400">SUPPORT</p>
                  <p className="text-base text-neutral-900">Mon–Fri, 9am–6pm</p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 lg:pl-10">
            <div className="rounded-[2rem] bg-neutral-50 ring-1 ring-neutral-200 p-8 sm:p-10">
              {submitted ? (
                <div className="py-16 text-center">
                  <p style={mono} className="text-[10px] tracking-[0.3em] text-orange-500 mb-3">MESSAGE SENT</p>
                  <h3 style={serif} className="text-3xl mb-3">Thanks — we'll be in touch.</h3>
                  <p className="text-neutral-600">We typically reply within one business day.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label style={mono} className="block text-[10px] tracking-[0.25em] text-neutral-500 mb-2">NAME</label>
                      <input required type="text" className="w-full h-11 px-4 rounded-lg bg-white ring-1 ring-neutral-200 focus:ring-2 focus:ring-neutral-900 outline-none transition-all" placeholder="Jane Doe" />
                    </div>
                    <div>
                      <label style={mono} className="block text-[10px] tracking-[0.25em] text-neutral-500 mb-2">BUSINESS</label>
                      <input type="text" className="w-full h-11 px-4 rounded-lg bg-white ring-1 ring-neutral-200 focus:ring-2 focus:ring-neutral-900 outline-none transition-all" placeholder="Your company" />
                    </div>
                  </div>
                  <div>
                    <label style={mono} className="block text-[10px] tracking-[0.25em] text-neutral-500 mb-2">EMAIL</label>
                    <input required type="email" className="w-full h-11 px-4 rounded-lg bg-white ring-1 ring-neutral-200 focus:ring-2 focus:ring-neutral-900 outline-none transition-all" placeholder="you@company.com" />
                  </div>
                  <div>
                    <label style={mono} className="block text-[10px] tracking-[0.25em] text-neutral-500 mb-2">MESSAGE</label>
                    <textarea required rows={5} className="w-full px-4 py-3 rounded-lg bg-white ring-1 ring-neutral-200 focus:ring-2 focus:ring-neutral-900 outline-none transition-all resize-none" placeholder="Tell us a bit about your operation…" />
                  </div>
                  <button type="submit" className="group inline-flex items-center justify-between gap-6 w-full sm:w-auto px-7 py-4 bg-neutral-900 text-white rounded-full hover:bg-black transition-colors">
                    <span className="text-sm font-medium tracking-wide">Send message</span>
                    <span className="w-8 h-8 rounded-full bg-orange-400 text-neutral-900 flex items-center justify-center group-hover:rotate-45 transition-transform duration-500">
                      <ArrowUpRight className="w-4 h-4" />
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
};

export default ContactPage;
