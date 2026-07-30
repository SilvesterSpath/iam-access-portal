import { Router } from 'express';
import { prisma } from '../prisma.js';

export const auditLogsRouter = Router();

auditLogsRouter.get('/', async (_req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        targetUser: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    res.json(
      logs.map((log) => ({
        id: log.id,
        actorEmail: log.actorEmail,
        targetUserId: log.targetUserId,
        targetUser: log.targetUser,
        action: log.action,
        details: log.details,
        createdAt: log.createdAt,
      })),
    );
  } catch (error) {
    next(error);
  }
});
