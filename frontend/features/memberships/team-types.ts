export interface TeamMember {
  id: string; status: "ACTIVE" | "SUSPENDED"; joinedAt: string;
  user: { id: string; firstName: string; lastName: string | null; email: string; status: string };
  role: { code: string; name: string };
  serviceAccess: { serviceId: string; accessMode: "READ_ONLY" | "READ_WRITE" }[];
}
export interface TeamInvitation {
  id: string; email: string; status: string; expiresAt: string; createdAt: string;
  role: { code: string; name: string };
  invitedBy: { firstName: string; lastName: string | null };
}
export interface RoleOption { code: string; name: string; isSystem: boolean }
export interface ServiceOption { id: string; code: string; name: string }
