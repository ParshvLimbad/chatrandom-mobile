const requiredKeys = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_WORKER_URL",
  "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
] as const;

for (const key of requiredKeys) {
  if (!process.env[key]) {
    console.warn(`[env] Missing ${key}. Configure it in .env before running Speaky.`);
  }
}

export const env = {
  admobAppId:
    process.env.EXPO_PUBLIC_ADMOB_APP_ID ??
    "ca-app-pub-3237855763291333~5680255634",
  admobBannerUnitId:
    process.env.EXPO_PUBLIC_ADMOB_BANNER_ID ??
    "ca-app-pub-3237855763291333/9884794764",
  admobInterstitialUnitId:
    process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ??
    "ca-app-pub-3237855763291333/3319386416",
  revenueCatAndroidApiKey:
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "",
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvdmRkcnh1a2FjdGp5emNoYXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMzY1NTYsImV4cCI6MjA2NzgxMjU1Nn0.S0woMp4kLa8o2TWO1W2yuuAt9xUt59R2OFx21Z_ZqoM",
  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    "https://zovddrxukactjyzchavo.supabase.co",
  workerUrl:
    process.env.EXPO_PUBLIC_WORKER_URL ??
    "https://speaky-signal.drop-share-free.workers.dev",
};
