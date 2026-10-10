import type { AgeGroup, Lang, Practice, Reflection, ReviewStatus, Source, TrainingSession } from "@mourabbi/schemas";

export interface Profile {
  id: string;
  language: Lang;
  default_age_group: AgeGroup | null;
}

export interface PracticeRow {
  id: string;
  owner: string;
  title: string;
  data: Practice;
  source: Source;
  review_status: ReviewStatus;
  parent_template_id: string | null;
  /** The owner's private notes. Never copied into share snapshots. */
  notes: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type NewPractice = Pick<PracticeRow, "id" | "owner" | "title" | "data" | "source" | "review_status" | "parent_template_id" | "notes">;
export type PracticePatch = Partial<Pick<PracticeRow, "title" | "data" | "review_status" | "notes">>;

export interface SessionRow {
  id: string;
  owner: string;
  data: TrainingSession;
  reflection: Reflection | null;
  created_at: string;
  updated_at: string;
}

export interface ShareRow {
  id: string;
  owner: string;
  /** The library practice or template id this link was made from, so "Update link" can find it. */
  practice_id: string | null;
  snapshot: Practice;
  created_at: string;
  revoked_at: string | null;
  views: number;
}

export interface GenerationLog {
  owner: string;
  kind: "session" | "practice";
  input: unknown;
  output: unknown;
  valid: boolean;
  retries: number;
}

/** Everything the app persists. Implementations: in-memory (dev/e2e) and Supabase. */
export interface Store {
  getProfile(userId: string): Promise<Profile | null>;
  upsertProfile(profile: Profile): Promise<void>;

  listPractices(owner: string): Promise<PracticeRow[]>;
  getPractice(owner: string, id: string): Promise<PracticeRow | null>;
  countPractices(owner: string): Promise<number>;
  insertPractice(row: NewPractice): Promise<PracticeRow>;
  updatePractice(owner: string, id: string, patch: PracticePatch): Promise<PracticeRow | null>;
  /** Soft delete. */
  deletePractice(owner: string, id: string): Promise<boolean>;

  listSessions(owner: string, limit: number): Promise<SessionRow[]>;
  getSession(owner: string, id: string): Promise<SessionRow | null>;
  upsertSession(row: { id: string; owner: string; data: TrainingSession; reflection: Reflection | null }): Promise<SessionRow>;

  createShare(row: { id: string; owner: string; practice_id: string | null; snapshot: Practice }): Promise<ShareRow>;
  /** Public read by id. Callers must check `revoked_at`. */
  getShare(id: string): Promise<ShareRow | null>;
  findActiveShare(owner: string, practiceId: string): Promise<ShareRow | null>;
  updateShareSnapshot(owner: string, id: string, snapshot: Practice): Promise<ShareRow | null>;
  revokeShare(owner: string, id: string): Promise<boolean>;
  incrementViews(id: string): Promise<void>;
  countSharesSince(owner: string, sinceIso: string): Promise<number>;

  logGeneration(row: GenerationLog): Promise<void>;
  countGenerationsSince(owner: string, sinceIso: string): Promise<number>;

  addReport(sharedId: string, reason: string | null): Promise<void>;
}
