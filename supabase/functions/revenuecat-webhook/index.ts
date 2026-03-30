import { createClient } from "npm:@supabase/supabase-js@2";

interface RevenueCatEvent {
  app_user_id?: string;
  entitlement_ids?: string[];
  entitlement_id?: string;
  event_timestamp_ms?: number;
  expiration_at_ms?: number | null;
  product_id?: string;
  type?: string;
}

const ACTIVE_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "NON_RENEWING_PURCHASE",
  "PRODUCT_CHANGE",
  "RENEWAL",
  "SUBSCRIPTION_EXTENDED",
  "TRANSFER",
  "UNCANCELLATION",
]);

Deno.serve(async (request: Request) => {
  const webhookAuth = Deno.env.get("RC_WEBHOOK_AUTH_HEADER");
  if (
    webhookAuth &&
    request.headers.get("authorization") !== webhookAuth
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = (await request.json()) as { event?: RevenueCatEvent } | RevenueCatEvent;
  const event = "event" in payload ? payload.event : payload;
  if (!event?.app_user_id) {
    return new Response("Missing app_user_id", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const isActive = event.type ? ACTIVE_EVENTS.has(event.type) : false;
  const expiresAt =
    typeof event.expiration_at_ms === "number"
      ? new Date(event.expiration_at_ms).toISOString()
      : null;

  const { error } = await supabase.from("subscription_state").upsert({
    entitlement_id:
      event.entitlement_ids?.[0] ?? event.entitlement_id ?? null,
    expires_at: expiresAt,
    is_active: isActive,
    product_id: event.product_id ?? null,
    user_id: event.app_user_id,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    processedAt:
      typeof event.event_timestamp_ms === "number"
        ? new Date(event.event_timestamp_ms).toISOString()
        : new Date().toISOString(),
  });
});
