import { type ElementType } from "react";
import {
  Sparkles, Megaphone, MessageSquare, Palette, Code2, PhoneCall,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LaunchCountdown } from "@/components/launch-countdown";
import { LAUNCH_LABEL, TRIAL_LABEL } from "@/lib/launch";

interface Announcement {
  date: string;
  tag: string;
  title: string;
  body: string;
}

// Static, admin-curated changelog. New entries are added here as features ship.
const ANNOUNCEMENTS: Announcement[] = [
  {
    date: "July 2026",
    tag: "Launch",
    title: `Olyxee Logistics is going live on ${LAUNCH_LABEL}`,
    body: `We're moving out of beta. On launch day, new plans become available and existing beta businesses get Growth free for the first week (${TRIAL_LABEL}). Nothing changes for you before then — keep using everything as you do today.`,
  },
  {
    date: "July 2026",
    tag: "Heads up",
    title: "SMS notifications, branding & more on the way",
    body: "We're building SMS order updates, custom business branding on your tracking pages, a public API, and an AI call agent. Scroll down for a preview of what's coming.",
  },
];

interface UpcomingFeature {
  icon: ElementType;
  title: string;
  description: string;
  plan: string;
}

// Marketing preview of the disabled foundations shipping around launch. These
// are informational only — none of these features are active yet.
const FEATURES: UpcomingFeature[] = [
  {
    icon: MessageSquare,
    title: "SMS notifications",
    description:
      "Send order status updates by SMS in addition to email, so customers hear from you wherever they are.",
    plan: "Growth & Scale",
  },
  {
    icon: Palette,
    title: "Business branding",
    description:
      "Add your logo, colours and sender name to tracking pages and emails — and remove Olyxee branding.",
    plan: "Growth & Scale",
  },
  {
    icon: Code2,
    title: "Public API",
    description:
      "Create and track orders programmatically with API keys, so you can plug Olyxee Logistics into your own systems.",
    plan: "Scale",
  },
  {
    icon: PhoneCall,
    title: "AI call agent",
    description:
      "An AI voice agent answers customer calls about their orders and escalates to your team when needed.",
    plan: "Scale",
  },
];

export default function UpdatesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">What&apos;s New</h1>
          <p className="text-sm text-muted-foreground">
            Product news, announcements and what&apos;s coming next.
          </p>
        </div>
      </div>

      {/* Countdown to launch */}
      <Card className="border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center gap-2 text-primary">
          <Megaphone className="h-4 w-4" />
          <span className="text-sm font-semibold">Countdown to launch</span>
        </div>
        <div className="mt-4">
          <LaunchCountdown />
        </div>
      </Card>

      {/* Latest announcements */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Latest
        </h2>
        <div className="space-y-4">
          {ANNOUNCEMENTS.map((a, i) => (
            <Card key={i} className="p-6" data-testid={`announcement-${i}`}>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="secondary">{a.tag}</Badge>
                <span className="text-xs text-muted-foreground">{a.date}</span>
              </div>
              <h3 className="text-lg font-semibold">{a.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {a.body}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Coming soon */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Coming soon
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Card key={f.title} className="p-6" data-testid={`upcoming-${f.title}`}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/70">
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {f.description}
                  </p>
                  <Badge variant="outline" className="mt-3">
                    {f.plan}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
