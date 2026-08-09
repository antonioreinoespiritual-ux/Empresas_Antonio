import { commerce } from "@/lib/commerce";
import { PageHeader, Table, TableHeadCell, TableRow, TableCell, EmptyState, Button } from "@repo/admin-ui/primitives";
import { PublishToggle } from "./publish-toggle";

const TYPE_LABEL: Record<string, string> = {
  DIGITAL: "Digital",
  PHYSICAL: "Físico",
  SERVICE: "Servicio",
  SUBSCRIPTION: "Suscripción",
};

export default async function ProductsPage() {
  const products = await commerce.products.list();

  return (
    <div>
      <PageHeader
        title="Productos"
        description="Lo que realmente se entrega — una oferta empaqueta uno o más productos con un precio."
        actions={<Button href="/products/new">+ Nuevo producto</Button>}
      />

      {products.length === 0 ? (
        <EmptyState
          title="Todavía no hay productos"
          description="Crea el primer producto para poder empaquetarlo en una oferta."
          action={<Button href="/products/new">+ Nuevo producto</Button>}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <TableHeadCell className="w-[40%]">Nombre</TableHeadCell>
              <TableHeadCell className="w-[24%]">Tipo</TableHeadCell>
              <TableHeadCell className="w-[20%]">Estado</TableHeadCell>
              <TableHeadCell className="w-[16%]" />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="break-words font-medium">{product.name}</TableCell>
                <TableCell className="text-ink-muted">{TYPE_LABEL[product.type] ?? product.type}</TableCell>
                <TableCell>
                  <PublishToggle productId={product.id} status={product.status} />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button href={`/products/${product.id}/edit`} variant="ghost" size="sm">
                      Editar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
