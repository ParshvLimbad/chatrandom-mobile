import { Redirect } from "expo-router";

import { useAuthStore } from "@/stores/auth-store";

export default function IndexRoute(): JSX.Element | null {
  const initialized = useAuthStore((state) => state.initialized);
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);

  if (!initialized) {
    return null;
  }

  if (!session) {
    return <Redirect href="/auth" />;
  }

  if (!profile?.onboarding_completed_at) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/video" />;
}
