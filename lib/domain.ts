import type { Session } from "@supabase/supabase-js";

export type ChatMode = "text" | "video" | "voice";
export type Gender = "female" | "male" | "non_binary" | "other";
export type MatchStatus = "idle" | "matched" | "queued" | "searching";
export type ReportReason = "harassment" | "nudity" | "spam" | "underage";
export type SignalKind = "answer" | "ice_candidate" | "offer";
export type QualityLevel = "excellent" | "fair" | "poor" | "unknown";

export interface AppProfile {
  banned_at: string | null;
  country_code: string;
  created_at: string;
  date_of_birth: string;
  gender: Gender;
  id: string;
  interests: string[];
  onboarding_completed_at: string | null;
  report_count: number;
  updated_at: string;
  username: string;
  warning_seen_at: string | null;
}

export interface MatchPreferences {
  country_filters: string[];
  gender_filters: Gender[];
  interest_filters: string[];
  updated_at: string;
  user_id: string;
}

export interface SubscriptionState {
  entitlement_id: string | null;
  expires_at: string | null;
  is_active: boolean;
  product_id: string | null;
  updated_at: string;
  user_id: string;
}

export interface MatchPartnerMeta {
  country_code: string;
  gender: Gender;
  interests: string[];
}

export interface ChatMessage {
  id: string;
  sender: "self" | "stranger";
  text: string;
  timestamp: string;
}

export interface MatchSession {
  ad_eligible: boolean;
  initiator: boolean;
  matchedAt: string;
  partner: MatchPartnerMeta;
  roomId: string;
}

export interface OnboardingInput {
  country_code: string;
  date_of_birth: string;
  gender: Gender;
  interests: string[];
  username: string;
}

export interface ProfileUpdateInput {
  country_code: string;
  gender: Gender;
  interests: string[];
  username: string;
}

export interface PreferenceUpdateInput {
  country_filters: string[];
  gender_filters: Gender[];
  interest_filters: string[];
}

export interface AuthSnapshot {
  initialized: boolean;
  preferences: MatchPreferences | null;
  profile: AppProfile | null;
  session: Session | null;
  subscription: SubscriptionState | null;
}
