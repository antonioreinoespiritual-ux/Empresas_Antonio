export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 border-r px-4 py-6">
        <nav className="flex flex-col gap-2 text-sm">
          <a href="/orders">Pedidos</a>
          <a href="/products">Productos</a>
          <a href="/users">Usuarios</a>
        </nav>
      </aside>
      <div className="flex-1 px-8 py-6">{children}</div>
    </div>
  );
}
