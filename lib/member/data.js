import { apiRequest } from '@/lib/api-client';

export function fetchMemberData(_now, { signal } = {}) {
  return apiRequest('/api/v1/me/dashboard', { signal });
}
