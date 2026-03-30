const SOUTH_ASIA_CLUSTER = ["BD", "IN", "LK", "NP", "PK"] as const;
const GULF_CLUSTER = ["AE", "EG", "PK", "SA"] as const;
const EUROPE_CLUSTER = ["DE", "ES", "FR", "GB", "IT", "NL", "TR"] as const;
const APAC_CLUSTER = ["AU", "ID", "JP", "KR", "MY", "PH", "SG", "TH", "VN"] as const;
const AMERICAS_CLUSTER = ["BR", "CA", "MX", "US"] as const;
const AFRICA_CLUSTER = ["EG", "KE", "NG", "ZA"] as const;

export const COUNTRY_CLUSTERS: Record<string, readonly string[]> = {
  AE: GULF_CLUSTER,
  AU: APAC_CLUSTER,
  BD: SOUTH_ASIA_CLUSTER,
  BR: AMERICAS_CLUSTER,
  CA: AMERICAS_CLUSTER,
  DE: EUROPE_CLUSTER,
  EG: AFRICA_CLUSTER,
  ES: EUROPE_CLUSTER,
  FR: EUROPE_CLUSTER,
  GB: EUROPE_CLUSTER,
  ID: APAC_CLUSTER,
  IN: SOUTH_ASIA_CLUSTER,
  IT: EUROPE_CLUSTER,
  JP: APAC_CLUSTER,
  KE: AFRICA_CLUSTER,
  KR: APAC_CLUSTER,
  LK: SOUTH_ASIA_CLUSTER,
  MX: AMERICAS_CLUSTER,
  MY: APAC_CLUSTER,
  NG: AFRICA_CLUSTER,
  NP: SOUTH_ASIA_CLUSTER,
  PH: APAC_CLUSTER,
  PK: SOUTH_ASIA_CLUSTER,
  SA: GULF_CLUSTER,
  SG: APAC_CLUSTER,
  TH: APAC_CLUSTER,
  TR: EUROPE_CLUSTER,
  US: AMERICAS_CLUSTER,
  VN: APAC_CLUSTER,
  ZA: AFRICA_CLUSTER,
};

export function getFreeTierCountryPool(countryCode: string): string[] {
  return [...(COUNTRY_CLUSTERS[countryCode] ?? [countryCode])];
}
