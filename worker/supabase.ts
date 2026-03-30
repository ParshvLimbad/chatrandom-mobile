import type { ChatMode, Gender } from "../lib/domain";
import type { Env } from "./index";

export interface ProfileRow {
  banned_at: string | null;
  country_code: string;
  gender: Gender;
  id: string;
  interests: string[];
  onboarding_completed_at: string | null;
  report_count: number;
  username: string;
  warning_seen_at: string | null;
}

export interface MatchPreferencesRow {
  country_filters: string[];
  gender_filters: Gender[];
  interest_filters: string[];
}

export interface SubscriptionRow {
  entitlement_id: string | null;
  expires_at: string | null;
  is_active: boolean;
  product_id: string | null;
}

export interface JoinContext {
  joinCount: number;
  preferences: MatchPreferencesRow;
  profile: ProfileRow;
  subscription: SubscriptionRow;
  userId: string;
}

export interface ReportResult {
  banned: boolean;
  reportCount: number;
  warned: boolean;
}

interface RpcReportRow {
  banned: boolean;
  report_count: number;
  warned: boolean;
}

function createHeaders(accessToken: string, env: Env): HeadersInit {
  return {
    apikey: env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function fetchJson<T>(request: Request): Promise<T> {
  const response = await fetch(request);
  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as T;
}

async function fetchUserId(accessToken: string, env: Env): Promise<string> {
  const response = await fetchJson<{ id: string }>(
    new Request(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: createHeaders(accessToken, env),
    }),
  );
  return response.id;
}

async function fetchRow<T>(
  accessToken: string,
  env: Env,
  table: string,
  userId: string,
): Promise<T | null> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("id", `eq.${userId}`);
  url.searchParams.set("select", "*");

  const response = await fetch(
    new Request(url.toString(), {
      headers: createHeaders(accessToken, env),
    }),
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as T[];
  return rows[0] ?? null;
}

async function fetchPreferenceRow(
  accessToken: string,
  env: Env,
  userId: string,
): Promise<MatchPreferencesRow | null> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/match_preferences`);
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set("select", "*");

  const response = await fetch(
    new Request(url.toString(), {
      headers: createHeaders(accessToken, env),
    }),
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as MatchPreferencesRow[];
  return rows[0] ?? null;
}

async function fetchSubscriptionRow(
  accessToken: string,
  env: Env,
  userId: string,
): Promise<SubscriptionRow | null> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/subscription_state`);
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set("select", "*");

  const response = await fetch(
    new Request(url.toString(), {
      headers: createHeaders(accessToken, env),
    }),
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const rows = (await response.json()) as SubscriptionRow[];
  return rows[0] ?? null;
}

async function incrementJoinCount(
  accessToken: string,
  env: Env,
): Promise<number> {
  const response = await fetchJson<number | { join_count: number }>(
    new Request(`${env.SUPABASE_URL}/rest/v1/rpc/increment_join_count`, {
      body: JSON.stringify({}),
      headers: createHeaders(accessToken, env),
      method: "POST",
    }),
  );

  if (typeof response === "number") {
    return response;
  }

  return response.join_count;
}

export async function hydrateJoinContext(
  accessToken: string,
  env: Env,
): Promise<JoinContext> {
  const userId = await fetchUserId(accessToken, env);
  const [profile, preferences, subscription, joinCount] = await Promise.all([
    fetchRow<ProfileRow>(accessToken, env, "profiles", userId),
    fetchPreferenceRow(accessToken, env, userId),
    fetchSubscriptionRow(accessToken, env, userId),
    incrementJoinCount(accessToken, env),
  ]);

  if (!profile) {
    throw new Error("Profile not found. Complete onboarding first.");
  }

  return {
    joinCount,
    preferences: preferences ?? {
      country_filters: [],
      gender_filters: [],
      interest_filters: [],
    },
    profile,
    subscription: subscription ?? {
      entitlement_id: null,
      expires_at: null,
      is_active: false,
      product_id: null,
    },
    userId,
  };
}

export async function submitUserReport(
  accessToken: string,
  env: Env,
  payload: {
    matchId: string;
    mode: ChatMode;
    reason: string;
    targetUserId: string;
  },
): Promise<ReportResult> {
  const response = await fetchJson<RpcReportRow>(
    new Request(`${env.SUPABASE_URL}/rest/v1/rpc/submit_user_report`, {
      body: JSON.stringify({
        p_match_id: payload.matchId,
        p_mode: payload.mode,
        p_reason: payload.reason,
        p_reported_user_id: payload.targetUserId,
      }),
      headers: createHeaders(accessToken, env),
      method: "POST",
    }),
  );

  return {
    banned: response.banned,
    reportCount: response.report_count,
    warned: response.warned,
  };
}
