import VendorCategoriesManager from '@/components/settings/VendorCategoriesManager';

export default function VendorCategoriesPage() {
    return (
        <div className="space-y-6">
            <div className="bg-white p-4 md:p-6 rounded-lg border">
                <VendorCategoriesManager />
            </div>
        </div>
    );
}
