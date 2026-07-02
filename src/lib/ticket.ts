// Ticket codes are formatted as `YYMMDD-NN` (e.g. `260702-05`).
// `NN` is the small daily number (1..10000), the full code stays globally unique.
export function parseTicketCode(code: string | null | undefined): {
  daily: string;
  full: string;
} {
  const full = (code ?? "").trim();
  const m = full.match(/-(\d+)$/);
  return { daily: m ? String(parseInt(m[1], 10)) : full, full };
}
