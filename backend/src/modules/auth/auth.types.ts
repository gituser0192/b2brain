export interface AuthContext {
  userId: string;
  organizationId: string;
  membershipId: string;
  roleCode: string;
  permissions: string[];
  isPlatformAdmin: boolean;
}

export interface SessionMetadata { userAgent?: string; ipAddress?: string; }

export interface RegisterInput {
  invitationToken: string;
  firstName: string;
  lastName?: string;
  password: string;
}

export interface LoginInput { email: string; password: string; }
