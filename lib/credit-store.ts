import { AccessError, balanceSQL } from './accounts';

export type PersonalGrant = { id: string; amount: number; note: string; created: string };
export type PersonalCredit = {
  balance: number;
  granted: number;
  spent: number;
  reserved: number;
  historical: number;
  grants: PersonalGrant[];
};
export type PersonalUsage = {
  id: string;
  provider: string;
  cost: number;
  status: string;
  created: string;
  note: string;
};
type Totals = {
  balance: number;
  granted: number;
  spent: number;
  reserved: number;
  historical: number;
};

/** Cumulative totals and own grant receipts share a read-only D1 batch snapshot. */
export async function personalCredit(
  database: D1Database,
  userId: string,
): Promise<PersonalCredit> {
  const results = await database.batch<Totals | PersonalGrant>([
    database
      .prepare(
        `SELECT ${balanceSQL} AS balance,
      COALESCE((SELECT SUM(amount_micros) FROM credit_grants WHERE user_id=users.id),0) AS granted,
      COALESCE((SELECT SUM(cost_micros) FROM ledger WHERE user_id=users.id AND status='settled'),0) AS spent,
      COALESCE((SELECT SUM(cost_micros) FROM ledger WHERE user_id=users.id AND status='reserved'),0) AS reserved,
      COALESCE((SELECT SUM(cost_micros) FROM ledger WHERE user_id=users.id AND status='legacy'),0) AS historical
      FROM users WHERE id=?`,
      )
      .bind(userId),
    database
      .prepare(
        `SELECT id,amount_micros/1000000.0 AS amount,note,created FROM credit_grants
      WHERE user_id=? ORDER BY created DESC,id DESC LIMIT 100`,
      )
      .bind(userId),
  ]);
  const totals = results[0].results[0] as Totals | undefined;
  if (!totals) throw new AccessError('User tidak ditemukan.', 404);
  return {
    balance: totals.balance / 1e6,
    granted: totals.granted / 1e6,
    spent: totals.spent / 1e6,
    reserved: totals.reserved / 1e6,
    historical: totals.historical / 1e6,
    grants: results[1].results as PersonalGrant[],
  };
}
