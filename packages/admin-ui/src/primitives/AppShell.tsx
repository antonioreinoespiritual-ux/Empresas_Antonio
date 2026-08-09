import type { ReactNode } from "react";

export function AppShell({ sidebar, topbar, children }: { sidebar: ReactNode; topbar: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-canvas">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar}
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
