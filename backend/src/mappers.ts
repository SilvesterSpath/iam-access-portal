import type { Role, User, UserRole } from './generated/prisma/client.js';

type UserWithRoles = User & {
  roles: (UserRole & { role: Role })[];
};

export function mapUser(user: UserWithRoles) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    roles: user.roles.map((assignment) => ({
      id: assignment.role.id,
      name: assignment.role.name,
      description: assignment.role.description,
    })),
  };
}

export function normalizeRoleIds(roleIds: unknown): string[] {
  if (roleIds === undefined || roleIds === null) {
    return [];
  }

  if (!Array.isArray(roleIds) || roleIds.some((id) => typeof id !== 'string')) {
    throw new Error('INVALID_ROLE_IDS_SHAPE');
  }

  return [...new Set(roleIds)];
}
