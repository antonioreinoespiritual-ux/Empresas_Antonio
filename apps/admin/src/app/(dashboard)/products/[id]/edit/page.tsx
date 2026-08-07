import { notFound } from "next/navigation";
import { commerce } from "@/lib/commerce";
import { ProductForm } from "../../product-form";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const product = await commerce.products.findById(params.id);
  if (!product) {
    notFound();
  }

  return (
    <main>
      <h1 className="text-2xl font-semibold">Editar producto</h1>
      <ProductForm productId={product.id} defaultValues={{ name: product.name, type: product.type }} />
    </main>
  );
}
