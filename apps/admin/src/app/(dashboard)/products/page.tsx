import Link from "next/link";
import { commerce } from "@/lib/commerce";
import { PublishToggle } from "./publish-toggle";

export default async function ProductsPage() {
  const products = await commerce.products.list();

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Productos</h1>
        <Link className="rounded bg-neutral-900 px-4 py-2 text-sm text-white" href="/products/new">
          Nuevo producto
        </Link>
      </div>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-neutral-500">
            <th className="py-2">Nombre</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-b">
              <td className="py-2">{product.name}</td>
              <td>{product.type}</td>
              <td>
                <PublishToggle productId={product.id} status={product.status} />
              </td>
              <td className="text-right">
                <Link className="underline" href={`/products/${product.id}/edit`}>
                  Editar
                </Link>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td className="py-4 text-neutral-500" colSpan={4}>
                Todavía no hay productos.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
