import ProductsManager from '@/components/label-studio/ProductsManager';

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white p-4 md:p-6 rounded-md border">
        <ProductsManager />
      </div>
    </div>
  );
}
