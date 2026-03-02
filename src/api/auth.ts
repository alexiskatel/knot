import { api } from './client';

export interface TeamInfo {
  id: number;
  nom: string;
  couleur_primaire: string;
  code_unique?: string;
}

export interface UserInfo {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  is_admin?: boolean;
}

export interface ValidateCodeResponse {
  success: boolean;
  list: TeamInfo;
}

export interface ValidateKeyResponse {
  success: boolean;
  list: {
    user: UserInfo;
    team: TeamInfo;
  };
}

export interface BootstrapResponse {
  success: boolean;
  list: {
    team: TeamInfo & { code_unique: string };
    user: UserInfo & { is_admin: boolean };
    api_key: string;
  };
}

export async function validateTeamCode(code: string): Promise<TeamInfo> {
  const res = await api.post<ValidateCodeResponse>('/teams/validate-code', { code }, false);
  return res.list;
}

export async function validateApiKey(apiKey: string, teamId: number): Promise<{ user: UserInfo; team: TeamInfo }> {
  const res = await api.post<ValidateKeyResponse>('/auth/validate-key', { api_key: apiKey, team_id: teamId }, false);
  return res.list;
}

export async function bootstrapTeam(data: {
  nom: string;
  code_unique: string;
  admin_nom: string;
  admin_prenom?: string;
  admin_email: string;
  couleur_primaire?: string;
}): Promise<{ team: TeamInfo & { code_unique: string }; user: UserInfo & { is_admin: boolean }; api_key: string }> {
  const res = await api.post<BootstrapResponse>('/teams/bootstrap', data, false);
  return res.list;
}
