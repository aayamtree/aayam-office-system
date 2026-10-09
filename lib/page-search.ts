// Shared matching for the per-page search boxes (see components/shared/PageSearch).
// Every typed word must be found somewhere in the item; "dp2809009", "#DP-2809009"
// and "2809009" all find the same job because punctuation is ignored too.

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function matchesQuery(parts: Array<string | number | null | undefined>, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).map(w => w.replace(/^#/, '')).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = parts.filter(p => p !== null && p !== undefined).join(' ').toLowerCase();
  const squashed = compact(haystack);
  return words.every(w => haystack.includes(w) || (compact(w) !== '' && squashed.includes(compact(w))));
}

// A job (or a row that carries a `job`) — number, title, client, product type, box/consignment.
export function jobMatches(job: any, query: string): boolean {
  if (!job) return false;
  return matchesQuery(
    [
      job.job_number,
      job.project_name,
      job.client?.company,
      job.client?.name,
      job.product_category,
      job.job_type,
      job.package?.consignment_no,
      job.invoice_reference,
    ],
    query,
  );
}
