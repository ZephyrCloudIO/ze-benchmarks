import { RoleDef, EvaluationCriteria, SuggestedCriteria } from './types';

const API_BASE_URL = import.meta.env.PUBLIC_VITE_API_URL || 'http://localhost:8787/api';

export async function fetchRoleDefs(): Promise<RoleDef[]> {
  const response = await fetch(`${API_BASE_URL}/roledefs`);
  if (!response.ok) throw new Error('Failed to fetch RoleDefs');
  return response.json();
}

export async function fetchRoleDefById(id: string): Promise<RoleDef> {
  const response = await fetch(`${API_BASE_URL}/roledefs/${id}`);
  if (!response.ok) throw new Error('Failed to fetch RoleDef');
  return response.json();
}

export async function createRoleDef(data: any): Promise<RoleDef> {
  const response = await fetch(`${API_BASE_URL}/roledefs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('apiKey') || ''}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create RoleDef');
  return response.json();
}

export async function updateRoleDef(id: string, data: any): Promise<RoleDef> {
  const response = await fetch(`${API_BASE_URL}/roledefs/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('apiKey') || ''}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update RoleDef');
  return response.json();
}

export async function deleteRoleDef(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/roledefs/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('apiKey') || ''}`,
    },
  });
  if (!response.ok) throw new Error('Failed to delete RoleDef');
}

export async function fetchSuggestedCriteria(role: string = 'general', category: string = 'all'): Promise<{ criteria: SuggestedCriteria[] }> {
  const response = await fetch(`${API_BASE_URL}/roledefs/criteria/suggestions?role=${role}&category=${category}`);
  if (!response.ok) throw new Error('Failed to fetch suggested criteria');
  return response.json();
}
