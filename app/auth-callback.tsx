import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createSessionFromUrl } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth-store";

export default function AuthCallbackScreen(): JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string | string[] }>();
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const initialized = useAuthStore((state) => state.initialized);
  const hydrateFromSession = useAuthStore((state) => state.hydrateFromSession);
  const authError = useAuthStore((state) => state.authError);
  const liveUrl = Linking.useURL();
  const [isResolving, setIsResolving] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const redirectUrl = useMemo(() => {
    if (Array.isArray(params.redirect)) {
      return params.redirect[0] ?? null;
    }

    return params.redirect ?? null;
  }, [params.redirect]);

  useEffect(() => {
    let active = true;

    const resolveSession = async (): Promise<void> => {
      const candidates = new Set<string>();

      if (redirectUrl) {
        candidates.add(decodeURIComponent(redirectUrl));
      }

      if (liveUrl) {
        candidates.add(liveUrl);
      }

      const initialUrl = await Linking.getInitialURL().catch(() => null);
      if (initialUrl) {
        candidates.add(initialUrl);
      }

      try {
        for (const candidate of candidates) {
          const nextSession = await createSessionFromUrl(candidate);
          if (nextSession) {
            await hydrateFromSession(nextSession);
            if (active) {
              setLocalError(null);
              setIsResolving(false);
            }
            return;
          }
        }

        if (active) {
          setIsResolving(false);
        }
      } catch (error) {
        if (active) {
          setLocalError(
            error instanceof Error
              ? error.message
              : "Unable to finish Google sign-in.",
          );
          setIsResolving(false);
        }
      }
    };

    void resolveSession();

    return () => {
      active = false;
    };
  }, [hydrateFromSession, liveUrl, redirectUrl]);

  useEffect(() => {
    if (!initialized || !session) {
      return;
    }

    router.replace(profile?.onboarding_completed_at ? "/video" : "/onboarding");
  }, [initialized, profile?.onboarding_completed_at, router, session]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ActivityIndicator color="#5be6c5" size="large" />
        <Text style={styles.title}>Completing Google sign-in</Text>
        <Text style={styles.body}>
          {isResolving
            ? "Hold on while Speaky restores your session."
            : localError ?? authError ?? "We could not complete the callback."}
        </Text>

        {!isResolving ? (
          <Pressable
            onPress={() => router.replace("/auth")}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>Back to sign in</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: {
    color: "#aab7c7",
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 280,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#5be6c5",
    borderRadius: 18,
    marginTop: 8,
    minHeight: 52,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.86,
  },
  buttonText: {
    color: "#07111f",
    fontSize: 15,
    fontWeight: "800",
  },
  container: {
    alignItems: "center",
    flex: 1,
    gap: 14,
    justifyContent: "center",
    padding: 24,
  },
  safeArea: {
    backgroundColor: "#07111f",
    flex: 1,
  },
  title: {
    color: "#f4f7fb",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },
});
