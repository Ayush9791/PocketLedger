export function formatINR(paise) {
  const rupees = Number(paise || 0) / 100;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(rupees);
}
export function todayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
export function rupeesToPaise(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Amount must be positive');
  return Math.round(n * 100);
}