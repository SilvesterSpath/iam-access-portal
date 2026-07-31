import { DEMO_ACTOR_EMAIL } from '../constants.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { Prisma } from '../generated/prisma/client.js';
import { mapUser, normalizeRoleIds } from '../mappers.js';
import { prisma } from '../prisma.js';

const userWithRolesInclude = {
  roles: {
    include: {
      role: true,
    },
  },
} as const;

function roleIdSetsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }

  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, index) => id === sortedB[index]);
}

function parseOptionalReason(reason: unknown): string | undefined {
  if (reason === undefined || reason === null) {
    return undefined;
  }

  if (typeof reason !== 'string') {
    throw new BadRequestError('reason must be a string');
  }

  const trimmed = reason.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function assertRolesExist(roleIds: string[]) {
  if (roleIds.length === 0) {
    return [] as { id: string; name: string }[];
  }

  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds } },
    select: { id: true, name: true },
  });

  if (roles.length !== roleIds.length) {
    throw new BadRequestError('One or more role IDs are invalid');
  }

  return roles;
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    include: userWithRolesInclude,
    orderBy: { createdAt: 'asc' },
  });

  return users.map(mapUser);
}

export async function createUser(input: {
  name: unknown;
  email: unknown;
  roleIds?: unknown;
}) {
  if (typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new BadRequestError('name is required');
  }

  if (typeof input.email !== 'string' || input.email.trim().length === 0) {
    throw new BadRequestError('email is required');
  }

  let normalizedRoleIds: string[];
  try {
    normalizedRoleIds = normalizeRoleIds(input.roleIds);
  } catch {
    throw new BadRequestError('roleIds must be an array of strings');
  }

  const roles = await assertRolesExist(normalizedRoleIds);
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          email,
          roles: {
            create: normalizedRoleIds.map((roleId) => ({ roleId })),
          },
        },
        include: userWithRolesInclude,
      });

      await tx.auditLog.create({
        data: {
          actorEmail: DEMO_ACTOR_EMAIL,
          targetUserId: created.id,
          action: 'USER_CREATED',
          details: {
            email: created.email,
            name: created.name,
            roleIds: normalizedRoleIds,
            roleNames: roles.map((role) => role.name),
          },
        },
      });

      return created;
    });

    return mapUser(user);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError('A user with this email already exists');
    }

    throw error;
  }
}

export async function updateUserRoles(
  userId: string,
  input: { roleIds: unknown; reason?: unknown },
) {
  if (input.roleIds === undefined || input.roleIds === null) {
    throw new BadRequestError('roleIds is required');
  }

  let normalizedRoleIds: string[];
  try {
    normalizedRoleIds = normalizeRoleIds(input.roleIds);
  } catch {
    throw new BadRequestError('roleIds must be an array of strings');
  }

  const reason = parseOptionalReason(input.reason);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithRolesInclude,
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const roles = await assertRolesExist(normalizedRoleIds);

  const beforeRoleIds = user.roles.map((assignment) => assignment.roleId);
  const beforeRoleNames = user.roles.map((assignment) => assignment.role.name);

  if (roleIdSetsEqual(beforeRoleIds, normalizedRoleIds)) {
    return mapUser(user);
  }

  const roleNameById = new Map(roles.map((role) => [role.id, role.name]));
  const afterRoleNames = normalizedRoleIds.map(
    (roleId) => roleNameById.get(roleId) as string,
  );
  const beforeNameSet = new Set(beforeRoleNames);
  const afterNameSet = new Set(afterRoleNames);
  const addedRoleNames = afterRoleNames.filter(
    (name) => !beforeNameSet.has(name),
  );
  const removedRoleNames = beforeRoleNames.filter(
    (name) => !afterNameSet.has(name),
  );

  const updated = await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId } });

    if (normalizedRoleIds.length > 0) {
      await tx.userRole.createMany({
        data: normalizedRoleIds.map((roleId) => ({ userId, roleId })),
      });
    }

    await tx.auditLog.create({
      data: {
        actorEmail: DEMO_ACTOR_EMAIL,
        targetUserId: userId,
        action: 'ROLES_UPDATED',
        details: {
          beforeRoleIds,
          afterRoleIds: normalizedRoleIds,
          beforeRoleNames,
          afterRoleNames,
          addedRoleNames,
          removedRoleNames,
          ...(reason ? { reason } : {}),
        },
      },
    });

    return tx.user.findUniqueOrThrow({
      where: { id: userId },
      include: userWithRolesInclude,
    });
  });

  return mapUser(updated);
}
