import { canManageMembership, getAccessContextForGym, getMembershipForUser } from '../access.js';
import { pool } from '../db.js';
import { normalizeEmail } from '../devAccess.js';

export async function requireGymManager(gymId, userId) {
  const membership = await getMembershipForUser(gymId, userId);
  if (!membership) {
    return { success: false, code: 404, error: 'Gym não encontrado para este usuário' };
  }

  if (!canManageMembership(membership)) {
    return { success: false, code: 403, error: 'Usuário sem permissão de gestão neste gym' };
  }

  const access = await getAccessContextForGym(gymId);
  return { success: true, membership, access };
}

export async function attachPendingMembershipsToUser(userId, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  await pool.query(
    `WITH matched AS (
       SELECT
         id,
         ROW_NUMBER() OVER (
           PARTITION BY gym_id
           ORDER BY created_at ASC, id ASC
         ) AS row_number
       FROM gym_memberships
       WHERE LOWER(pending_email) = LOWER($2)
         AND user_id IS NULL
     ),
     promoted AS (
       UPDATE gym_memberships gm
       SET user_id = $1,
           pending_email = NULL,
           status = 'active'
       FROM matched
       WHERE gm.id = matched.id
         AND matched.row_number = 1
       RETURNING gm.id
     )
     DELETE FROM gym_memberships gm
     USING matched
     WHERE gm.id = matched.id
       AND matched.row_number > 1`,
    [userId, normalizedEmail],
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
