import { getSalesAccess } from "../access";
import { getProducts } from "../actions";
import ProductList from "./ProductList";

export default async function ProductsPage() {
  const { access } = await getSalesAccess();
  if (!access.canView) return null;
  return <ProductList products={await getProducts()} canManage={access.canManage} />;
}
