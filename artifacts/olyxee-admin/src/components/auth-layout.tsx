import type { ReactNode } from "react";
import { Link } from "wouter";
import courierLoopLogo from "@assets/1_1780016152275.png";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-white px-4 py-10">
      <Link
        href="/"
        className="absolute top-6 left-6 inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        aria-label="Back to home"
        data-testid="link-auth-home"
      >
        <img
          src={courierLoopLogo}
          alt="Courier Loop"
          className="h-8 sm:h-10 w-auto"
          draggable={false}
        />
      </Link>
      <div className="w-full max-w-[420px]">{children}</div>
    </div>
  );
}
