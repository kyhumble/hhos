import { apiRequest } from './client';

export type EpisodeRow = {
  id: string;
  status: string;
  intakeStatus: string;
  careType: string | null;
  patientId: string;
  referralId: string | null;
  patientFirstName: string;
  patientLastName: string;
  mrn: string;
  flags: string[];
  socDueAt?: string | null;
  primaryDxIcd10?: string | null;
};

export async function listEpisodes(): Promise<EpisodeRow[]> {
  const res = await apiRequest<{ data: EpisodeRow[] }>('/v1/episodes');
  return res.data ?? [];
}
