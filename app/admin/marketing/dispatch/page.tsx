'use client';

import { useJobs, useAuth } from '@/lib/hooks';
import { Truck, CheckCircle } from 'lucide-react';

export default function MarketingDispatchPage() {
  const { profile, user } = useAuth();

  const { jobs, loading } = useJobs({
    orderBy: { column: 'updated_at', ascending: false }
  });

  if (loading) return <div>Loading...</div>;

  // Filter: Jobs created by THIS marketing person that are dispatched/delivered
  const myDispatchedJobs = jobs.filter(job =>
    job.created_by === user?.id && // Only my jobs
    ['dispatched', 'delivered'].includes(job.current_stage)
  );

  return (
    <div className="space-y-6">
      <h1 className="text-page-title text-gray-900">My Dispatched Orders</h1>
      <p className="text-gray-500">Track delivery status and commissions for your orders.</p>

      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 font-semibold text-gray-700">Client</th>
              <th className="p-4 font-semibold text-gray-700">Project</th>
              <th className="p-4 font-semibold text-gray-700">Status</th>
              <th className="p-4 font-semibold text-gray-700 text-right">Order Value</th>
              <th className="p-4 font-semibold text-gray-700 text-right">Commission (Est. 2%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {myDispatchedJobs.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">No dispatched orders yet.</td></tr>
            ) : myDispatchedJobs.map(job => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="p-4 font-medium">{job.client?.company}</td>
                <td className="p-4">{job.project_name}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold capitalize 
                    ${job.current_stage === 'delivered' ? 'bg-gray-100 text-gray-900' : 'bg-muted text-foreground'}`}>
                    {job.current_stage.replace('_', ' ')}
                  </span>
                </td>
                <td className="p-4 text-right font-mono">₹{job.total_amount}</td>
                <td className="p-4 text-right font-mono text-gray-900 font-bold">
                  ₹{(job.total_amount * 0.02).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
