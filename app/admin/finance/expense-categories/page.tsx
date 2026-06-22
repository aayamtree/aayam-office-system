import ExpenseCategoriesManager from '@/components/settings/ExpenseCategoriesManager';

export default function ExpenseCategoriesPage() {
    return (
        <div className="space-y-6">
            <div className="bg-white p-4 md:p-6 rounded-md border">
                <ExpenseCategoriesManager />
            </div>
        </div>
    );
}
