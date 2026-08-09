import type { ReactNode } from "react";

export function Topbar({ children }: { children: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-end border-b border-border bg-surface px-6">
      {children}
    </header>
  );
}
