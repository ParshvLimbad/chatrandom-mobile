import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
}

function extractTokensFromUrl(redirectUrl: string): AuthTokenPair | null {
  const url = new URL(redirectUrl.replace("#", "?"));
  const accessToken = url.searchParams.get("access_token");
  const refreshToken = url.searchParams.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL("/auth");

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

  const tokens = extractTokensFromUrl(result.url);
  if (!tokens) {
    throw new Error("Missing auth tokens in Google OAuth callback.");
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });

  if (sessionError) {
    throw sessionError;
  }
}
