import { Router } from 'express';
import { createUser, listUsers, updateUserRoles } from '../services/userRoles.js';

export const usersRouter = Router();

usersRouter.get('/', async (_req, res, next) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

usersRouter.post('/', async (req, res, next) => {
  try {
    const user = await createUser({
      name: req.body?.name,
      email: req.body?.email,
      roleIds: req.body?.roleIds,
    });
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

usersRouter.put('/:id/roles', async (req, res, next) => {
  try {
    const user = await updateUserRoles(req.params.id, req.body?.roleIds);
    res.json(user);
  } catch (error) {
    next(error);
  }
});
