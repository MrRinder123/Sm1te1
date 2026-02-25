import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

export const validateBody = <T>(schema: ZodSchema<T>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ errors: result.error.flatten() });
    }

    req.body = result.data;
    return next();
  };
