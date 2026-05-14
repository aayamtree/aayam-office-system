import BrandsManager from '@/components/label-studio/BrandsManager';

export default function BrandsPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white p-4 md:p-6 rounded-md border">
        <BrandsManager />
      </div>
    </div>
  );
}
