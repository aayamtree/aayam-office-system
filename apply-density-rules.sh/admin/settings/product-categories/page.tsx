import ProductCategoriesManager from '@/components/settings/ProductCategoriesManager';

export default function ProductCategoriesPage() {
    return (
        <div className="space-y-6">
            <div className="bg-white p-4 md:p-6 rounded-md border">
                <ProductCategoriesManager />
            </div>
        </div>
    );
}
