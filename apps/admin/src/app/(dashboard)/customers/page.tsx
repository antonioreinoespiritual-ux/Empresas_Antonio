import Link from "next/link";
import { commerce } from "@/lib/commerce";

export default async function CustomersPage() {
  const customers = await commerce.customers.list();

  return (
    <main>
      <h1 className="text-2xl font-semibold">Clientes</h1>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-neutral-500">
            <th className="py-2">Email</th>
            <th>Nombre</th>
            <th>Cuenta</th>
            <th>Pedidos</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id} className="border-b">
              <td className="py-2">{customer.email}</td>
              <td>{customer.name ?? "—"}</td>
              <td>{customer.userId ? "Con cuenta" : "Invitado"}</td>
              <td>{customer.ordersCount}</td>
              <td className="text-right">
                <Link className="underline" href={`/customers/${customer.id}`}>
                  Ver
                </Link>
              </td>
            </tr>
          ))}
          {customers.length === 0 && (
            <tr>
              <td className="py-4 text-neutral-500" colSpan={5}>
                Todavía no hay clientes.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
