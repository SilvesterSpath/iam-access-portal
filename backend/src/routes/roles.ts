import { Router } from 'express';
import { prisma } from '../prisma.js';

export const rolesRouter = Router();

rolesRouter.get('/', async (_req, res, next) => {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
    res.json(roles);
  } catch (error) {
    next(error);
  }
});
