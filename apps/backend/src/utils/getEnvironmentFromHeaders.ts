import { Request } from 'express';

export const getEnvironmentHeader = (req: Request): string | undefined => {
  return req.headers['x-environment'] as string;
};
