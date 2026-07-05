import {
  MessageSquare, Palette, Code2, PhoneCall, Rocket,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LaunchCountdown } from "@/components/launch-countdown";

interface UpcomingFeature {
  icon: React.ElementType;
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
    plan: "Pro & Business",
  },
  {
    icon: Palette,
    title: "Business branding",
    description:
      "Add your logo, colours and sender name to tracking pages and emails — and remove Olyxee branding.",
    plan: "Pro & Business",
  },
  {
    icon: Code2,
    title: "Public API",
    description:
      "Create and track orders programmatically with API keys, so you can plug Order Loop into your own systems.",
    plan: "Business",
  },
  {
    icon: PhoneCall,
    title: "Automated call centre",
    description:
      "An AI voice agent answers customer calls about their orders and escalates to your team when needed.",
    plan: "Business",
  },
];

export default function ComingSoonPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Rocket className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coming Soon</h1>
          <p className="text-sm text-muted-foreground">
            A preview of what we&apos;re building for the Order Loop launch.
          </p>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5 p-6">
        <LaunchCountdown />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <Card key={f.title} className="p-6" data-testid={`upcoming-${f.title}`}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/70">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold">{f.title}</h2>
                </div>
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
    </div>
  );
}
