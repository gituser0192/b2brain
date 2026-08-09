export const PLATFORM_ROLES = ["CUSTOMER", "ADMIN", "SUPER_ADMIN"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

// Fine-grained permission constants will be added with the roles and permissions module.
