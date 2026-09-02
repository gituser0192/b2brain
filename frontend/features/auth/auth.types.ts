export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  status: string;
  isPlatformAdmin: boolean;
}
export interface AuthOrganization {
  id: string;
  name: string;
  slug: string;
  status: string;
  timezone: string;
  currency: string;
  isServiceProvider: boolean;
  onboardingCompleted: boolean;
}
export interface AuthMembership {
  id: string;
  role: { code: string; name: string };
  permissions: string[];
}
export interface AuthSession {
  user: AuthUser;
  organization: AuthOrganization;
  membership: AuthMembership;
}
export interface AuthResponse {
  success: true;
  message?: string;
  data: AuthSession & { accessToken: string };
}
export interface MeResponse {
  success: true;
  data: AuthSession;
}
export interface RefreshResponse {
  success: true;
  data: AuthSession & { accessToken: string };
}
export interface RegistrationResponse {
  success: true;
  data: {
    user: { id: string; email: string };
    organization: { id: string; name: string; status: "PENDING_APPROVAL" };
    pendingApproval: true;
  };
}
