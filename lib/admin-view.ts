import type { Identity } from './accounts';

export type AdminUser = Identity & {
  active: number;
  created: string;
  balance: number;
  granted: number;
  x: number;
  ai: number;
  reserved: number;
};
export type AdminUsage = { provider: string; status: string; total: number; requests: number };
export type CreditGrant = {
  id: string;
  email: string;
  amount: number;
  note: string;
  created: string;
  actor: string;
};
export type LedgerEntry = {
  id: string;
  email: string;
  provider: string;
  cost: number;
  status: string;
  note: string;
  created: string;
};
export type AdminData = {
  user: Identity;
  users: AdminUser[];
  usage: AdminUsage[];
  grants: CreditGrant[];
  ledger: LedgerEntry[];
};
export { formatUSD } from './currency';
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase() || 'O';
export function providerTotals(usage: AdminUsage[], provider: string) {
  const rows = usage.filter((row) => row.provider === provider);
  const sum = (status?: string) =>
    rows
      .filter((row) => !status || row.status === status)
      .reduce((total, row) => total + row.total, 0);
  return {
    total: sum(),
    reserved: sum('reserved'),
    settled: sum('settled'),
    legacy: sum('legacy'),
    requests: rows.reduce((total, row) => total + row.requests, 0),
  };
}
export function filterUsers(users: AdminUser[], search: string, status = 'all', role = 'all') {
  const query = search.trim().toLowerCase();
  return users.filter(
    (user) =>
      `${user.name} ${user.email}`.toLowerCase().includes(query) &&
      (status === 'all' || (status === 'active' ? !!user.active : !user.active)) &&
      (role === 'all' || user.role === role),
  );
}
export function filterLedger(
  entries: LedgerEntry[],
  search: string,
  provider = 'all',
  status = 'all',
) {
  const query = search.trim().toLowerCase();
  return entries.filter(
    (entry) =>
      `${entry.email || ''} ${entry.note}`.toLowerCase().includes(query) &&
      (provider === 'all' || entry.provider === provider) &&
      (status === 'all' || entry.status === status),
  );
}
export function paginate<T>(items: T[], requestedPage: number, pageSize = 10) {
  const size = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 10;
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Number.isFinite(requestedPage)
    ? Math.min(pages, Math.max(1, Math.floor(requestedPage)))
    : 1;
  const start = (page - 1) * size;
  return {
    items: items.slice(start, start + size),
    page,
    pages,
    total: items.length,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + size, items.length),
  };
}
