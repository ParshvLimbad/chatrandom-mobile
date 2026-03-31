import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

function getGoogleRedirectUri(): string {
  return makeRedirectUri({
    scheme: "speaky",
  });
}

export async function createSessionFromUrl(
  redirectUrl: string,
): Promise<Session | null> {
  const { errorCode, params } = QueryParams.getQueryParams(redirectUrl);

  if (errorCode) {
    throw new Error(errorCode);
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;

  if (!accessToken || !refreshToken) {
    return null;
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = getGoogleRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
    provider: "google",
  });

  if (error) {
    throw error;
  }

  if (!data.url) {
    throw new Error("Supabase did not return an OAuth URL.");
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !result.url) {
    throw new Error("Google sign-in was cancelled.");
  }

  const session = await createSessionFromUrl(result.url);
  if (!session) {
    throw new Error("Missing auth tokens in Google OAuth callback.");
  }
}
