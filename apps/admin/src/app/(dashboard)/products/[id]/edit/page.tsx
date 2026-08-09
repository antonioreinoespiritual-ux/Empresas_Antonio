import { notFound } from "next/navigation";
import { commerce } from "@/lib/commerce";
import { PageHeader } from "@repo/admin-ui/primitives";
import { ProductForm } from "../../product-form";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const product = await commerce.products.findById(params.id);
  if (!product) {
    notFound();
  }

  return (
    <div>
      <PageHeader title="Editar producto" />
      <ProductForm productId={product.id} defaultValues={{ name: product.name, type: product.type }} />
    </div>
  );
}
