import { useEffect, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISSED_KEY = "olyxee_install_prompt_dismissed_at";
const REMIND_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
}

function recentlyDismissed() {
  const dismissedAt = Number(window.localStorage.getItem(DISMISSED_KEY));
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < REMIND_AFTER_MS;
}

export function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const handleInstalled = () => setVisible(false);

    window.addEventListener("beforeinstallprompt", handleInstallAvailable);
    window.addEventListener("appinstalled", handleInstalled);

    let timer: number | undefined;
    if (isIOS) {
      timer = window.setTimeout(() => {
        setShowIOSHelp(true);
        setVisible(true);
      }, 1200);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallAvailable);
      window.removeEventListener("appinstalled", handleInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      window.localStorage.removeItem(DISMISSED_KEY);
    } else {
      window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    }
    setInstallEvent(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-2xl border border-border/80 bg-background/95 p-4 shadow-2xl backdrop-blur sm:inset-x-auto sm:bottom-6 sm:right-6" role="dialog" aria-label="Install Olyxee Logistics">
      <button type="button" onClick={dismiss} className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Dismiss install suggestion"><X className="h-4 w-4" /></button>
      <div className="flex gap-3 pr-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Smartphone className="h-5 w-5" /></div>
        <div>
          <h2 className="text-sm font-semibold">Add Olyxee Logistics to your device</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Open your logistics workspace faster from your home screen or desktop.</p>
        </div>
      </div>
      {showIOSHelp && !installEvent ? (
        <div className="mt-4 rounded-xl bg-muted/50 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
          Tap <span className="inline-flex items-center gap-1 font-medium text-foreground"><Share className="h-3.5 w-3.5" /> Share</span>, then choose <span className="font-medium text-foreground">Add to Home Screen</span>.
        </div>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={dismiss}>Not now</Button>
        {installEvent ? <Button type="button" size="sm" className="gap-1.5" onClick={install}><Download className="h-3.5 w-3.5" /> Install</Button> : <Button type="button" size="sm" onClick={dismiss}>Got it</Button>}
      </div>
    </aside>
  );
}
