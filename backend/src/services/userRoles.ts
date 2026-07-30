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

export async function updateUserRoles(userId: string, roleIds: unknown) {
  if (roleIds === undefined || roleIds === null) {
    throw new BadRequestError('roleIds is required');
  }

  let normalizedRoleIds: string[];
  try {
    normalizedRoleIds = normalizeRoleIds(roleIds);
  } catch {
    throw new BadRequestError('roleIds must be an array of strings');
  }

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
          afterRoleNames: roles.map((role) => role.name),
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
