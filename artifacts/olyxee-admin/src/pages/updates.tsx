import { type ElementType } from "react";
import {
  Sparkles, Megaphone, MessageSquare, Palette, Code2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LaunchCountdown } from "@/components/launch-countdown";
import { LAUNCH_LABEL, SCALE_BILLING_START_LABEL } from "@/lib/launch";

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
    body: `We're moving out of beta. Existing businesses stay on the Free plan at no cost — nothing changes for you and no payment is required. The new Scale plan is visible now; Scale billing begins on ${SCALE_BILLING_START_LABEL}.`,
  },
  {
    date: "July 2026",
    tag: "Heads up",
    title: "Orgni Intelligence, branding & more on the way",
    body: "We're building Orgni Intelligence for Scale — automated follow-ups, document monitoring, and operational alerts — plus custom business branding on your tracking pages. Scroll down for a preview of what's coming.",
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
    title: "Orgni Intelligence",
    description:
      "Let Orgni help your team monitor jobs, handle routine follow-ups, and surface what actually needs attention.",
    plan: "Scale",
  },
  {
    icon: Palette,
    title: "Business branding",
    description:
      "Add your logo, colours and sender name to tracking pages and emails — and remove Olyxee branding.",
    plan: "Scale",
  },
  {
    icon: Code2,
    title: "Public API",
    description:
      "Create and track orders programmatically with API keys, so you can plug Olyxee Logistics into your own systems.",
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
