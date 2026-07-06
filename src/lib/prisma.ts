// A single shared Prisma client for the whole app.
// Importing this file anywhere gives you the same DB connection pool
// instead of each file creating its own (which would exhaust connections).

import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
