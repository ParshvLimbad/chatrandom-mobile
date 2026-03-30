import { Matchmaker } from "./matchmaker";

export { Matchmaker };

export interface Env {
  MATCHMAKER: DurableObjectNamespace<Matchmaker>;
  SUPABASE_ANON_KEY: string;
  SUPABASE_URL: string;
}

const MATCHMAKER_NAME = "global";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "speaky-signal",
      });
    }

    if (url.pathname !== "/ws") {
      return new Response("Not Found", { status: 404 });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected websocket upgrade", { status: 426 });
    }

    const id = env.MATCHMAKER.idFromName(MATCHMAKER_NAME);
    return env.MATCHMAKER.get(id).fetch(request);
  },
};
