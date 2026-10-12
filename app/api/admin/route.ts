import { db } from '../../../lib/store';
import { currentUser } from '../../../lib/auth';
import {
  AccessError,
  GrantInput,
  UserInput,
  UserUpdate,
  addUser,
  adminState,
  grantCredit,
  requireAdmin,
  updateUser,
} from '../../../lib/accounts';
import { body, failure, json } from '../../../lib/http';
export async function GET(request: Request) {
  try {
    return json(await adminState(db(), await currentUser(request)));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const user = await currentUser(request);
    requireAdmin(user);
    const input = await body(request);
    if (input.action === 'createUser') {
      const id = await addUser(db(), user, UserInput.parse(input));
      return json({ id });
    }
    if (input.action === 'updateUser') {
      await updateUser(db(), user, UserUpdate.parse(input));
      return json({ ok: true, sessionRevoked: input.id === user.id });
    }
    if (input.action === 'grantCredit') {
      await grantCredit(db(), user, GrantInput.parse(input));
      return json({ ok: true });
    }
    throw new AccessError('Aksi tidak dikenal.');
  } catch (e) {
    return failure(e);
  }
}
