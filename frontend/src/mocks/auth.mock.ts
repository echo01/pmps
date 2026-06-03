import { LoginResult, UserSession } from '../api/auth.api';
import { logger } from '../utils/logger';

const adminUser: UserSession = {
  id: 1,
  username: 'admin',
  employee_code: 'EMP-ADMIN',
  full_name: 'System Administrator',
  email: 'admin@example.com',
  roles: ['ADMIN'],
  permissions: ['ADMIN', 'Dashboard', 'SearchReport', 'EditTestResult', 'QCInspection', 'QASampling'],
};

export async function mockLogin(username: string): Promise<LoginResult> {
  logger.info('[LOGIN][MOCK][START]', { username });
  return {
    access_token: 'mock-access-token',
    user: username.toLowerCase().includes('viewer')
      ? {
          ...adminUser,
          id: 2,
          username,
          full_name: 'Mock Viewer',
          roles: ['VIEWER'],
          permissions: ['SearchReport'],
        }
      : adminUser,
  };
}

export async function mockMe(): Promise<{ user: UserSession }> {
  logger.info('[AUTH][ME][MOCK]', { mockMode: true });
  return { user: adminUser };
}
