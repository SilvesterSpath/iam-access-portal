export interface Role {
  id: string;
  name: string;
  description: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  roles: Role[];
}

export interface AuditDetails {
  beforeRoleIds?: string[];
  afterRoleIds?: string[];
  beforeRoleNames?: string[];
  afterRoleNames?: string[];
  roleIds?: string[];
  roleNames?: string[];
  email?: string;
  name?: string;
}

export interface AuditLog {
  id: string;
  actorEmail: string;
  targetUserId: string;
  targetUser: {
    id: string;
    email: string;
    name: string;
  } | null;
  action: string;
  details: AuditDetails;
  createdAt: string;
}
