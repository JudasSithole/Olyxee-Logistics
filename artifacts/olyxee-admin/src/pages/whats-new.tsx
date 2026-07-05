import { Sparkles, Megaphone } from "lucide-react";
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
    title: `Order Loop is going live on ${LAUNCH_LABEL}`,
    body: `We're moving out of beta. On launch day, new plans become available and existing beta businesses get Pro free for the first week (${TRIAL_LABEL}). Nothing changes for you before then — keep using everything as you do today.`,
  },
  {
    date: "July 2026",
    tag: "Coming soon",
    title: "SMS notifications, branding & more",
    body: "We're building SMS order updates, custom business branding on your tracking pages, a public API, and an automated call centre. Preview what's coming on the Coming Soon page.",
  },
];

export default function WhatsNewPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">What&apos;s New</h1>
          <p className="text-sm text-muted-foreground">
            Product news and announcements from the Order Loop team.
          </p>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center gap-2 text-primary">
          <Megaphone className="h-4 w-4" />
          <span className="text-sm font-semibold">Countdown to launch</span>
        </div>
        <div className="mt-4">
          <LaunchCountdown />
        </div>
      </Card>

      <div className="space-y-4">
        {ANNOUNCEMENTS.map((a, i) => (
          <Card key={i} className="p-6" data-testid={`announcement-${i}`}>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary">{a.tag}</Badge>
              <span className="text-xs text-muted-foreground">{a.date}</span>
            </div>
            <h2 className="text-lg font-semibold">{a.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {a.body}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
