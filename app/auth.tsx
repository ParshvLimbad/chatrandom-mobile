import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "@/stores/auth-store";

export default function AuthScreen(): JSX.Element {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const signIn = useAuthStore((state) => state.signInWithGoogle);
  const authError = useAuthStore((state) => state.authError);
  const isAuthenticating = useAuthStore((state) => state.isAuthenticating);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (profile?.onboarding_completed_at) {
      router.replace("/(tabs)/video");
      return;
    }

    router.replace("/onboarding");
  }, [profile?.onboarding_completed_at, router, session]);

  const handleGoogleLogin = async (): Promise<void> => {
    setLocalError(null);

    try {
      await signIn();
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Google sign-in failed.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>SPEAKY</Text>
        <Text style={styles.title}>Random chat, designed for Android.</Text>
        <Text style={styles.subtitle}>
          Sign in with Google, complete onboarding once, then jump between video,
          voice, and text tabs with the same matchmaking core.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Continue with Google</Text>
        <Text style={styles.cardBody}>
          Supabase handles authentication. We only ask for camera and mic access
          after your profile is complete.
        </Text>

        <Pressable
          disabled={isAuthenticating}
          onPress={handleGoogleLogin}
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && styles.ctaPressed,
            isAuthenticating && styles.ctaDisabled,
          ]}
        >
          {isAuthenticating ? (
            <ActivityIndicator color="#07111f" />
          ) : (
            <Text style={styles.ctaText}>Continue with Google</Text>
          )}
        </Pressable>

        {authError || localError ? (
          <Text style={styles.errorText}>{authError ?? localError}</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0d1628",
    borderColor: "#172033",
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    padding: 24,
  },
  cardBody: {
    color: "#9dacbf",
    fontSize: 15,
    lineHeight: 22,
  },
  cardTitle: {
    color: "#f4f7fb",
    fontSize: 24,
    fontWeight: "700",
  },
  ctaButton: {
    alignItems: "center",
    backgroundColor: "#5be6c5",
    borderRadius: 18,
    justifyContent: "center",
    minHeight: 56,
    marginTop: 8,
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    color: "#07111f",
    fontSize: 16,
    fontWeight: "800",
  },
  errorText: {
    color: "#ff9aa0",
    fontSize: 14,
    lineHeight: 20,
  },
  eyebrow: {
    color: "#5be6c5",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 3.2,
  },
  hero: {
    gap: 16,
    marginTop: 48,
  },
  safeArea: {
    backgroundColor: "#07111f",
    flex: 1,
    justifyContent: "space-between",
    padding: 24,
    paddingBottom: 40,
  },
  subtitle: {
    color: "#b3c0cf",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 320,
  },
  title: {
    color: "#f4f7fb",
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 42,
    maxWidth: 320,
  },
});
