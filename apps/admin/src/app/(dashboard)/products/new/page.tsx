import { PageHeader } from "@repo/admin-ui/primitives";
import { ProductForm } from "../product-form";

export default function NewProductPage() {
  return (
    <div>
      <PageHeader title="Nuevo producto" />
      <ProductForm />
    </div>
  );
}
