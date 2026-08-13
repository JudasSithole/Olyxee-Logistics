import type { ReactNode } from "react";
import { Link } from "wouter";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-white px-4 py-10">
      <Link
        href="/"
        className="absolute top-6 left-6 inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        aria-label="Back to home"
        data-testid="link-auth-home"
      >
        <span className="text-lg font-bold tracking-tight text-neutral-900">Olyxee Logistics</span>
      </Link>
      <div className="w-full max-w-[420px]">{children}</div>
    </div>
  );
}
