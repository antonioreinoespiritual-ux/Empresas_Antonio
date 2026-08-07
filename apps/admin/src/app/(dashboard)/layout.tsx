import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@repo/core/infrastructure";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await adminAuth.api.getSession({ headers: headers() });
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 border-r px-4 py-6">
        <nav className="flex flex-col gap-2 text-sm">
          <a href="/orders">Pedidos</a>
          <a href="/products">Productos</a>
          <a href="/offers">Ofertas</a>
          <a href="/users">Usuarios</a>
        </nav>
      </aside>
      <div className="flex-1 px-8 py-6">
        <header className="mb-6 flex items-center justify-between border-b pb-4 text-sm text-neutral-600">
          <span>{session.user.email}</span>
          <LogoutButton />
        </header>
        {children}
      </div>
    </div>
  );
}
