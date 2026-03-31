import type { ReactNode } from "react";
import { useEffect } from "react";
import * as Linking from "expo-linking";

import { createSessionFromUrl } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth-store";

interface AppBootstrapProps {
  children: ReactNode;
}

export function AppBootstrap({ children }: AppBootstrapProps): JSX.Element {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const hydrateFromSession = useAuthStore((state) => state.hydrateFromSession);

  useEffect(() => {
    let active = true;

    const hydrateFromUrl = async (url: string | null | undefined): Promise<void> => {
      if (!url) {
        return;
      }

      try {
        const session = await createSessionFromUrl(url);
        if (session && active) {
          await hydrateFromSession(session);
        }
      } catch {
        // Auth screens already surface session bootstrap failures.
      }
    };

    void (async () => {
      const initialUrl = await Linking.getInitialURL().catch(() => null);
      await hydrateFromUrl(initialUrl);
      await bootstrap().catch(() => undefined);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateFromSession(session).catch(() => undefined);
    });

    const linkingSubscription = Linking.addEventListener("url", ({ url }) => {
      void hydrateFromUrl(url);
    });

    return () => {
      active = false;
      linkingSubscription.remove();
      subscription.unsubscribe();
    };
  }, [bootstrap, hydrateFromSession]);

  return <>{children}</>;
}
