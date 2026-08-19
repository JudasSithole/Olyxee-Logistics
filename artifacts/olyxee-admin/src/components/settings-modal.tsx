import { createContext, useContext, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import SettingsPage from "@/pages/settings";

// Lets any component (e.g. the account menu) open Settings as an overlay.
export const SettingsModalContext = createContext<{ open: () => void }>({ open: () => {} });
export const useSettingsModal = () => useContext(SettingsModalContext);

// Settings rendered as a popup that blurs the app behind it. Reuses the whole
// Settings workspace (sidebar + pages + save bar) unchanged.
export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-md motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150 sm:p-6 md:p-10"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onMouseDown={onClose}
    >
      {/* Fixed height + width so the modal never resizes when you switch tabs —
          the content area inside scrolls instead. */}
      <div
        className="relative my-auto flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150 lg:h-[90vh] lg:max-w-6xl xl:max-w-[1240px]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex min-h-0 flex-1">
          <SettingsPage inModal />
        </div>
      </div>
    </div>,
    document.body,
  );
}
