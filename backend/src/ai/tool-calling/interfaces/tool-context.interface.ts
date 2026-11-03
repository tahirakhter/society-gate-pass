import type { UserRole } from '@prisma/client';

export interface ToolContext {
  userId: string;
  role: UserRole;
  conversationId?: string | null;
  timezone: string;
  locale?: string | null;
}
