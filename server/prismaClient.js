import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const DEFAULT_STATE_ID = 'standalone-default';
export const APP_STATE_ID = 'app-state-primary';
