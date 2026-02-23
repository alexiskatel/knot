import { api } from './client';

export interface TeamInfo {
  id: number;
  nom: string;
  couleur_primaire: string;
}

export interface UserInfo {
  id: number;
  nom: string;
  prenom: string;
  email: string;
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

export async function validateTeamCode(code: string): Promise<TeamInfo> {
  const res = await api.post<ValidateCodeResponse>('/teams/validate-code', { code }, false);
  return res.list;
}

export async function validateApiKey(apiKey: string, teamId: number): Promise<{ user: UserInfo; team: TeamInfo }> {
  const res = await api.post<ValidateKeyResponse>('/auth/validate-key', { api_key: apiKey, team_id: teamId }, false);
  return res.list;
}
