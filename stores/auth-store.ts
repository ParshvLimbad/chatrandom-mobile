import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { signInWithGoogle } from "@/lib/auth";
import type {
  AppProfile,
  MatchPreferences,
  OnboardingInput,
  PreferenceUpdateInput,
  ProfileUpdateInput,
  SubscriptionState,
} from "@/lib/domain";
import { configurePurchases } from "@/lib/purchases";
import { supabase } from "@/lib/supabase";

interface AuthState {
  authError: string | null;
  bootstrap: () => Promise<void>;
  hydrateFromSession: (session: Session | null) => Promise<void>;
  initialized: boolean;
  isAuthenticating: boolean;
  isPremium: () => boolean;
  preferences: MatchPreferences | null;
  profile: AppProfile | null;
  saveOnboarding: (input: OnboardingInput) => Promise<void>;
  session: Session | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  subscription: SubscriptionState | null;
  syncSubscription: () => Promise<void>;
  updatePreferences: (input: PreferenceUpdateInput) => Promise<void>;
  updateProfile: (input: ProfileUpdateInput) => Promise<void>;
}

async function fetchAccountData(
  userId: string,
): Promise<{
  preferences: MatchPreferences | null;
  profile: AppProfile | null;
  subscription: SubscriptionState | null;
}> {
  const [profileResult, preferencesResult, subscriptionResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle<AppProfile>(),
    supabase
      .from("match_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle<MatchPreferences>(),
    supabase
      .from("subscription_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle<SubscriptionState>(),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }
  if (preferencesResult.error) {
    throw preferencesResult.error;
  }
  if (subscriptionResult.error) {
    throw subscriptionResult.error;
  }

  return {
    preferences: preferencesResult.data,
    profile: profileResult.data,
    subscription: subscriptionResult.data,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  authError: null,
  bootstrap: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await get().hydrateFromSession(session);
    set({ initialized: true });
  },
  hydrateFromSession: async (session) => {
    if (!session) {
      set({
        authError: null,
        preferences: null,
        profile: null,
        session: null,
        subscription: null,
      });
      return;
    }

    await configurePurchases(session.user.id);
    const accountData = await fetchAccountData(session.user.id);

    set({
      authError: null,
      preferences:
        accountData.preferences ?? {
          country_filters: [],
          gender_filters: [],
          interest_filters: [],
          updated_at: new Date().toISOString(),
          user_id: session.user.id,
        },
      profile: accountData.profile,
      session,
      subscription:
        accountData.subscription ?? {
          entitlement_id: null,
          expires_at: null,
          is_active: false,
          product_id: null,
          updated_at: new Date().toISOString(),
          user_id: session.user.id,
        },
    });
  },
  initialized: false,
  isAuthenticating: false,
  isPremium: () => Boolean(get().subscription?.is_active),
  preferences: null,
  profile: null,
  saveOnboarding: async (input) => {
    const session = get().session;
    if (!session) {
      throw new Error("You must be logged in.");
    }

    const now = new Date().toISOString();
    const [profileResult, preferencesResult] = await Promise.all([
      supabase
        .from("profiles")
        .upsert({
          country_code: input.country_code,
          date_of_birth: input.date_of_birth,
          gender: input.gender,
          id: session.user.id,
          interests: input.interests,
          onboarding_completed_at: now,
          username: input.username,
        })
        .select("*")
        .single<AppProfile>(),
      supabase
        .from("match_preferences")
        .upsert({
          country_filters: [],
          gender_filters: [],
          interest_filters: [],
          user_id: session.user.id,
        })
        .select("*")
        .single<MatchPreferences>(),
    ]);

    if (profileResult.error) {
      throw profileResult.error;
    }
    if (preferencesResult.error) {
      throw preferencesResult.error;
    }

    set({
      preferences: preferencesResult.data,
      profile: profileResult.data,
    });
  },
  session: null,
  signInWithGoogle: async () => {
    set({ authError: null, isAuthenticating: true });

    try {
      await signInWithGoogle();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to sign in with Google.";
      set({ authError: message });
      throw error;
    } finally {
      set({ isAuthenticating: false });
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({
      authError: null,
      preferences: null,
      profile: null,
      session: null,
      subscription: null,
    });
  },
  subscription: null,
  syncSubscription: async () => {
    const session = get().session;
    if (!session) {
      return;
    }

    const accountData = await fetchAccountData(session.user.id);
    set({
      preferences: accountData.preferences ?? get().preferences,
      profile: accountData.profile ?? get().profile,
      subscription: accountData.subscription ?? get().subscription,
    });
  },
  updatePreferences: async (input) => {
    const session = get().session;
    if (!session) {
      throw new Error("You must be logged in.");
    }

    const result = await supabase
      .from("match_preferences")
      .upsert({
        country_filters: input.country_filters,
        gender_filters: input.gender_filters,
        interest_filters: input.interest_filters,
        user_id: session.user.id,
      })
      .select("*")
      .single<MatchPreferences>();

    if (result.error) {
      throw result.error;
    }

    set({ preferences: result.data });
  },
  updateProfile: async (input) => {
    const session = get().session;
    if (!session) {
      throw new Error("You must be logged in.");
    }

    const result = await supabase
      .from("profiles")
      .update({
        country_code: input.country_code,
        gender: input.gender,
        interests: input.interests,
        username: input.username,
      })
      .eq("id", session.user.id)
      .select("*")
      .single<AppProfile>();

    if (result.error) {
      throw result.error;
    }

    set({ profile: result.data });
  },
}));
