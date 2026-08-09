import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@repo/core/infrastructure";
import { AppShell, Sidebar, Topbar, ToastProvider } from "@repo/admin-ui/primitives";
import { LogoutButton } from "@/components/logout-button";

const NAV_ITEMS = [
  { label: "Pedidos", href: "/orders" },
  { label: "Productos", href: "/products" },
  { label: "Ofertas", href: "/offers" },
  { label: "Clientes", href: "/customers" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await adminAuth.api.getSession({ headers: headers() });
  if (!session) {
    redirect("/login");
  }

  return (
    <ToastProvider>
      <AppShell
        sidebar={<Sidebar brand="Empresas Antonio" items={NAV_ITEMS} />}
        topbar={
          <Topbar>
            <div className="flex items-center gap-4 text-sm text-ink-muted">
              <span>{session.user.email}</span>
              <LogoutButton />
            </div>
          </Topbar>
        }
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
