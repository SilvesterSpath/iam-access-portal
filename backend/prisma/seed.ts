import { prisma } from '../src/prisma.js';

async function main() {
  const admin = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
      name: 'Admin',
      description: 'Full administrative access',
    },
  });

  const support = await prisma.role.upsert({
    where: { name: 'Support' },
    update: {},
    create: {
      name: 'Support',
      description: 'Customer and operations support access',
    },
  });

  const viewer = await prisma.role.upsert({
    where: { name: 'Viewer' },
    update: {},
    create: {
      name: 'Viewer',
      description: 'Read-only access',
    },
  });

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      name: 'Alice Admin',
      email: 'alice@example.com',
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      name: 'Bob Support',
      email: 'bob@example.com',
    },
  });

  const cara = await prisma.user.upsert({
    where: { email: 'cara@example.com' },
    update: {},
    create: {
      name: 'Cara Viewer',
      email: 'cara@example.com',
    },
  });

  await prisma.userRole.deleteMany({
    where: {
      userId: { in: [alice.id, bob.id, cara.id] },
    },
  });

  await prisma.userRole.createMany({
    data: [
      { userId: alice.id, roleId: admin.id },
      { userId: alice.id, roleId: viewer.id },
      { userId: bob.id, roleId: support.id },
      { userId: cara.id, roleId: viewer.id },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
