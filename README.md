# Speaky - Random Video Chat

Android-first Expo app for random video, voice, and text chat with Supabase auth/profile storage, a Cloudflare Worker + Durable Object signaling backend, RevenueCat paywall hooks, AdMob monetization, and client-side NSFW moderation based on the [Infinitered `nsfwjs-mobile`](https://github.com/infinitered/nsfwjs-mobile) approach.

## Status

- GitHub repo: [ParshvLimbad/chatrandom-mobile](https://github.com/ParshvLimbad/chatrandom-mobile)
- Cloudflare Worker: [https://speaky-signal.drop-share-free.workers.dev](https://speaky-signal.drop-share-free.workers.dev)
- RevenueCat webhook function: `https://zovddrxukactjyzchavo.supabase.co/functions/v1/revenuecat-webhook`

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│ Expo / React Native (Android)                                  │
│                                                                 │
│ Google login -> Supabase Auth                                   │
│ Onboarding/profile -> Supabase tables                           │
│ Tabs: Video / Voice / Chat / Settings                           │
│                                                                 │
│ Video + Voice -> react-native-webrtc                            │
│ Text chat -> Worker WebSocket room relay                        │
│ Ads -> AdMob banner + interstitial                              │
│ Subscription UI -> RevenueCat SDK                               │
│ NSFW sampling -> capture remote frame -> nsfwjs/tfjs            │
└───────────────┬───────────────────────────────┬─────────────────┘
                │                               │
                │ WebSocket / matchmaking       │ webhook
                ▼                               ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│ Cloudflare Worker            │   │ Supabase Edge Function       │
│ Durable Object: Matchmaker   │   │ revenuecat-webhook           │
│ Authenticates Supabase JWT   │   │ Mirrors entitlement state    │
│ Enforces free/premium rules  │   └──────────────┬───────────────┘
│ Relays WebRTC + chat events  │                  │
└───────────────┬──────────────┘                  │
                ▼                                 ▼
        ┌────────────────────────────────────────────────────────┐
        │ Supabase Postgres                                     │
        │ profiles / match_preferences / user_reports /         │
        │ subscription_state + RPCs for join counts/reports     │
        └────────────────────────────────────────────────────────┘
```

## Features

- Google sign-in via Supabase native OAuth flow
- Mandatory onboarding with age gate 16+, DOB, gender, country, username, and interests
- 4-tab shell: `video`, `voice`, `chat`, `settings`
- Video + voice WebRTC sessions with Cloudflare Worker signaling
- Text chat in the same room/session protocol
- Free-tier matchmaking bias:
  - local-country clusters by default
  - one foreign exception every 10 joins
  - same-gender bias for male/female profiles with periodic exception
- Premium UI hooks:
  - country filters
  - gender filters
  - interest filters
  - no ads
- AdMob free-tier banner + interstitial cadence
- NSFW moderation using bundled NSFWJS model assets
- Reporting, warning at 5 reports, ban at 10 reports

## Local Setup

### 1. Install dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Configure env vars

Copy [.env.example](./.env.example) to `.env` and fill in the missing values:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://zovddrxukactjyzchavo.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_WORKER_URL=https://speaky-signal.drop-share-free.workers.dev
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=...
EXPO_PUBLIC_ADMOB_APP_ID=ca-app-pub-3237855763291333~5680255634
EXPO_PUBLIC_ADMOB_BANNER_ID=ca-app-pub-3237855763291333/9884794764
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID=ca-app-pub-3237855763291333/3319386416
```

### 3. Run the app

Expo Go is not supported for this project. Use a custom dev client.

```bash
npm run prebuild
npm run android
```

### 4. Typecheck and lint

```bash
npm run typecheck
npm run lint
```

## Supabase

### Database objects

This repo includes the migration at [supabase/migrations/20260330193000_speaky_init.sql](./supabase/migrations/20260330193000_speaky_init.sql).

It creates:

- `profiles`
- `match_preferences`
- `user_reports`
- `subscription_state`
- `increment_join_count()` RPC
- `submit_user_report(...)` RPC

### Edge function

The RevenueCat sync function source is at [supabase/functions/revenuecat-webhook/index.ts](./supabase/functions/revenuecat-webhook/index.ts).

Deployed endpoint:

```text
https://zovddrxukactjyzchavo.supabase.co/functions/v1/revenuecat-webhook
```

Optional hardening:

- Set `RC_WEBHOOK_AUTH_HEADER` in Supabase function secrets
- Reuse the same header value in the RevenueCat webhook integration

## Cloudflare Worker

Worker config is in [worker/wrangler.toml](./worker/wrangler.toml).

Deploy:

```bash
npm run worker:deploy
```

Current deployed URL:

```text
https://speaky-signal.drop-share-free.workers.dev
```

## RevenueCat

The app code is wired for RevenueCat, but you still need an active RevenueCat project configured with:

- Android app package: `chat.speaky.app`
- Entitlement: `premium_filters`
- Current offering: `default`
- Package: `$rc_monthly`
- Android public SDK key added to `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
- Webhook pointing to:
  - `https://zovddrxukactjyzchavo.supabase.co/functions/v1/revenuecat-webhook`

Current product wiring:

- Product ID: `speaky_plus`
- Base plan: `monthly`
- RevenueCat store identifier: `speaky_plus:monthly`

## Matchmaking Rules

### Free tier

- Country matching stays inside static local clusters
- Every 10th join allows a foreign-country match
- Same-gender bias for male/female profiles with a periodic exception
- Banner ads on free surfaces, hidden during active media sessions
- Interstitial shown every 5 joins

### Premium

- Country filters
- Gender filters
- Interest filters
- No ads

## Moderation

- Remote video is sampled every 4 seconds in `video` mode
- Frames are classified locally with bundled NSFWJS model assets
- `Porn` or `Hentai` at `>= 0.8` triggers auto-report + auto-skip
- Manual report flow supports `Nudity`, `Harassment`, `Underage`, `Spam`

## Deploy Checklist

1. Set Expo public env vars.
2. Verify Google auth redirect settings in Supabase for scheme `speaky`.
3. Build a dev client or production Android build with EAS.
4. Confirm Worker URL is set in the Expo env.
5. Confirm RevenueCat webhook is pointing to the deployed Supabase function.
6. Confirm AdMob IDs are correct for the production app.
7. Test on a physical Android device for camera, mic, OAuth, Worker signaling, RevenueCat, and ads.
