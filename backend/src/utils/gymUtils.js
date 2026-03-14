import { canManageGym, getAccessContextForGym, getMembershipForUser } from '../access.js';
import { pool } from '../db.js';

export async function requireGymManager(gymId, userId) {
  const membership = await getMembershipForUser(gymId, userId);
  if (!membership) {
    return { success: false, code: 404, error: 'Gym não encontrado para este usuário' };
  }

  if (!canManageGym(membership.role)) {
    return { success: false, code: 403, error: 'Usuário sem permissão de gestão neste gym' };
  }

  const access = await getAccessContextForGym(gymId);
  return { success: true, membership, access };
}

export async function attachPendingMembershipsToUser(userId, email) {
  await pool.query(
    `UPDATE gym_memberships
     SET user_id = $1, pending_email = NULL, status = 'active'
     WHERE pending_email = $2 AND user_id IS NULL`,
    [userId, String(email || '').toLowerCase().trim()],
  );
}

export function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}
