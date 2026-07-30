import type { AuditLog, Role, User } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getUsers() {
  return request<User[]>('/api/users');
}

export function getRoles() {
  return request<Role[]>('/api/roles');
}

export function getAuditLogs() {
  return request<AuditLog[]>('/api/audit-logs');
}

export function createUser(input: {
  name: string;
  email: string;
  roleIds: string[];
}) {
  return request<User>('/api/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateUserRoles(userId: string, roleIds: string[]) {
  return request<User>(`/api/users/${userId}/roles`, {
    method: 'PUT',
    body: JSON.stringify({ roleIds }),
  });
}
