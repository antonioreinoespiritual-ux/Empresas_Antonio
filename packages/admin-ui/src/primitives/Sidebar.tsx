"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../utils/cn";

export interface SidebarItem {
  label: string;
  href: string;
}

export interface SidebarProps {
  brand: string;
  items: SidebarItem[];
}

/**
 * Sección activa siempre visible — sin esto el operador no tiene referencia
 * de "dónde estoy" al navegar entre Ofertas → Editar → Páginas. Depende de
 * next/navigation a propósito: admin-ui solo tiene un consumidor real
 * (apps/admin), así que desacoplarlo de Next no compra nada.
 */
export function Sidebar({ brand, items }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface px-3 py-5">
      <div className="px-2 pb-5 text-sm font-bold tracking-tight text-ink">{brand}</div>
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-accent-soft text-accent-strong" : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
