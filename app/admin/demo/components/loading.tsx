export default function Loading() {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-[#0000FF] rounded-full animate-spin mx-auto"></div>
                <p className="mt-4 text-gray-600 text-sm">Loading components...</p>
            </div>
        </div>
    );
}
