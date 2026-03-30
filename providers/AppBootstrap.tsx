import type { ReactNode } from "react";
import { useEffect } from "react";

import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth-store";

interface AppBootstrapProps {
  children: ReactNode;
}

export function AppBootstrap({ children }: AppBootstrapProps): JSX.Element {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const hydrateFromSession = useAuthStore((state) => state.hydrateFromSession);

  useEffect(() => {
    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateFromSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [bootstrap, hydrateFromSession]);

  return <>{children}</>;
}
