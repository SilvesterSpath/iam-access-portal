import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { DEMO_ACTOR_EMAIL } from '../src/constants.js';
import { prisma } from '../src/prisma.js';

const app = createApp();

async function resetDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
}

async function seedRoles() {
  const admin = await prisma.role.create({
    data: { name: 'Admin', description: 'Full administrative access' },
  });
  const support = await prisma.role.create({
    data: {
      name: 'Support',
      description: 'Customer and operations support access',
    },
  });
  const viewer = await prisma.role.create({
    data: { name: 'Viewer', description: 'Read-only access' },
  });

  return { admin, support, viewer };
}

async function countRolesUpdated(targetUserId: string) {
  return prisma.auditLog.count({
    where: { targetUserId, action: 'ROLES_UPDATED' },
  });
}

describe('user roles API', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('updates roles and writes a ROLES_UPDATED audit log', async () => {
    const { support, viewer } = await seedRoles();
    const user = await prisma.user.create({
      data: {
        name: 'Cara Viewer',
        email: 'cara@example.com',
        roles: { create: [{ roleId: viewer.id }] },
      },
    });

    const response = await request(app)
      .put(`/api/users/${user.id}/roles`)
      .send({ roleIds: [support.id] })
      .expect(200);

    expect(response.body.roles).toHaveLength(1);
    expect(response.body.roles[0].id).toBe(support.id);
    expect(response.body.roles[0].name).toBe('Support');

    const assignments = await prisma.userRole.findMany({
      where: { userId: user.id },
    });
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.roleId).toBe(support.id);

    const audits = await prisma.auditLog.findMany({
      where: { targetUserId: user.id, action: 'ROLES_UPDATED' },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.actorEmail).toBe(DEMO_ACTOR_EMAIL);

    const details = audits[0]?.details as {
      beforeRoleIds: string[];
      afterRoleIds: string[];
      beforeRoleNames: string[];
      afterRoleNames: string[];
      addedRoleNames: string[];
      removedRoleNames: string[];
    };
    expect(details.beforeRoleIds).toEqual([viewer.id]);
    expect(details.afterRoleIds).toEqual([support.id]);
    expect(details.beforeRoleNames).toEqual(['Viewer']);
    expect(details.afterRoleNames).toEqual(['Support']);
    expect(details.addedRoleNames).toEqual(['Support']);
    expect(details.removedRoleNames).toEqual(['Viewer']);
  });

  it('rejects invalid role IDs without changing roles or writing audit', async () => {
    const { viewer } = await seedRoles();
    const user = await prisma.user.create({
      data: {
        name: 'Cara Viewer',
        email: 'cara@example.com',
        roles: { create: [{ roleId: viewer.id }] },
      },
    });

    const beforeCount = await countRolesUpdated(user.id);

    await request(app)
      .put(`/api/users/${user.id}/roles`)
      .send({ roleIds: ['00000000-0000-0000-0000-000000000000'] })
      .expect(400);

    const assignments = await prisma.userRole.findMany({
      where: { userId: user.id },
    });
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.roleId).toBe(viewer.id);

    expect(await countRolesUpdated(user.id)).toBe(beforeCount);
  });

  it('deduplicates roleIds in assignments and audit details', async () => {
    const { viewer } = await seedRoles();
    const user = await prisma.user.create({
      data: {
        name: 'Cara Viewer',
        email: 'cara@example.com',
      },
    });

    const response = await request(app)
      .put(`/api/users/${user.id}/roles`)
      .send({ roleIds: [viewer.id, viewer.id] })
      .expect(200);

    expect(response.body.roles).toHaveLength(1);
    expect(response.body.roles[0].id).toBe(viewer.id);

    const assignments = await prisma.userRole.findMany({
      where: { userId: user.id },
    });
    expect(assignments).toHaveLength(1);

    const audits = await prisma.auditLog.findMany({
      where: { targetUserId: user.id, action: 'ROLES_UPDATED' },
    });
    expect(audits).toHaveLength(1);

    const details = audits[0]?.details as { afterRoleIds: string[] };
    expect(details.afterRoleIds).toEqual([viewer.id]);
  });

  it('skips writes and audit when the normalized role set is unchanged', async () => {
    const { admin, viewer } = await seedRoles();
    const user = await prisma.user.create({
      data: {
        name: 'Cara Viewer',
        email: 'cara@example.com',
        roles: {
          create: [{ roleId: admin.id }, { roleId: viewer.id }],
        },
      },
    });

    const beforeCount = await countRolesUpdated(user.id);

    const response = await request(app)
      .put(`/api/users/${user.id}/roles`)
      .send({ roleIds: [viewer.id, admin.id, viewer.id] })
      .expect(200);

    expect(response.body.roles).toHaveLength(2);
    expect(response.body.roles.map((role: { id: string }) => role.id).sort()).toEqual(
      [admin.id, viewer.id].sort(),
    );

    expect(await countRolesUpdated(user.id)).toBe(beforeCount);

    const assignments = await prisma.userRole.findMany({
      where: { userId: user.id },
    });
    expect(assignments).toHaveLength(2);
  });

  it('stores reason and role diffs on ROLES_UPDATED', async () => {
    const { admin, viewer } = await seedRoles();
    const user = await prisma.user.create({
      data: {
        name: 'Cara Viewer',
        email: 'cara@example.com',
        roles: { create: [{ roleId: viewer.id }] },
      },
    });

    await request(app)
      .put(`/api/users/${user.id}/roles`)
      .send({
        roleIds: [admin.id, viewer.id],
        reason: '  Temporary elevation for incident response  ',
      })
      .expect(200);

    const audits = await prisma.auditLog.findMany({
      where: { targetUserId: user.id, action: 'ROLES_UPDATED' },
    });
    expect(audits).toHaveLength(1);

    const details = audits[0]?.details as {
      reason: string;
      addedRoleNames: string[];
      removedRoleNames: string[];
    };
    expect(details.reason).toBe('Temporary elevation for incident response');
    expect(details.addedRoleNames).toEqual(['Admin']);
    expect(details.removedRoleNames).toEqual([]);
  });

  it('rejects a non-string reason without changing roles or writing audit', async () => {
    const { viewer } = await seedRoles();
    const user = await prisma.user.create({
      data: {
        name: 'Cara Viewer',
        email: 'cara@example.com',
        roles: { create: [{ roleId: viewer.id }] },
      },
    });

    const beforeCount = await countRolesUpdated(user.id);

    await request(app)
      .put(`/api/users/${user.id}/roles`)
      .send({ roleIds: [viewer.id], reason: 42 })
      .expect(400);

    expect(await countRolesUpdated(user.id)).toBe(beforeCount);
  });

  it('creates a USER_CREATED audit when adding a user with roles', async () => {
    const { admin } = await seedRoles();

    const response = await request(app)
      .post('/api/users')
      .send({
        name: 'Dana Demo',
        email: 'dana@example.com',
        roleIds: [admin.id],
      })
      .expect(201);

    expect(response.body.email).toBe('dana@example.com');
    expect(response.body.roles).toHaveLength(1);
    expect(response.body.roles[0].name).toBe('Admin');

    const audits = await prisma.auditLog.findMany({
      where: { targetUserId: response.body.id, action: 'USER_CREATED' },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.actorEmail).toBe(DEMO_ACTOR_EMAIL);
  });
});
