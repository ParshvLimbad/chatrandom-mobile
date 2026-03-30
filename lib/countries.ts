import type { Gender } from "@/lib/domain";

export type { Gender } from "@/lib/domain";

export interface CountryOption {
  code: string;
  flag: string;
  name: string;
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "IN", flag: "🇮🇳", name: "India" },
  { code: "PK", flag: "🇵🇰", name: "Pakistan" },
  { code: "BD", flag: "🇧🇩", name: "Bangladesh" },
  { code: "NP", flag: "🇳🇵", name: "Nepal" },
  { code: "LK", flag: "🇱🇰", name: "Sri Lanka" },
  { code: "AE", flag: "🇦🇪", name: "United Arab Emirates" },
  { code: "SA", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "US", flag: "🇺🇸", name: "United States" },
  { code: "CA", flag: "🇨🇦", name: "Canada" },
  { code: "GB", flag: "🇬🇧", name: "United Kingdom" },
  { code: "DE", flag: "🇩🇪", name: "Germany" },
  { code: "FR", flag: "🇫🇷", name: "France" },
  { code: "IT", flag: "🇮🇹", name: "Italy" },
  { code: "ES", flag: "🇪🇸", name: "Spain" },
  { code: "NL", flag: "🇳🇱", name: "Netherlands" },
  { code: "TR", flag: "🇹🇷", name: "Turkey" },
  { code: "BR", flag: "🇧🇷", name: "Brazil" },
  { code: "MX", flag: "🇲🇽", name: "Mexico" },
  { code: "ZA", flag: "🇿🇦", name: "South Africa" },
  { code: "NG", flag: "🇳🇬", name: "Nigeria" },
  { code: "EG", flag: "🇪🇬", name: "Egypt" },
  { code: "KE", flag: "🇰🇪", name: "Kenya" },
  { code: "TH", flag: "🇹🇭", name: "Thailand" },
  { code: "VN", flag: "🇻🇳", name: "Vietnam" },
  { code: "ID", flag: "🇮🇩", name: "Indonesia" },
  { code: "MY", flag: "🇲🇾", name: "Malaysia" },
  { code: "SG", flag: "🇸🇬", name: "Singapore" },
  { code: "PH", flag: "🇵🇭", name: "Philippines" },
  { code: "AU", flag: "🇦🇺", name: "Australia" },
  { code: "NZ", flag: "🇳🇿", name: "New Zealand" },
  { code: "JP", flag: "🇯🇵", name: "Japan" },
  { code: "KR", flag: "🇰🇷", name: "South Korea" },
];

export const GENDER_OPTIONS: { label: string; value: Gender }[] = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Non-binary", value: "non_binary" },
  { label: "Other", value: "other" },
];
