import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PricingCard } from "@/components/settings/PricingCard";
import { COUNTRY_OPTIONS, GENDER_OPTIONS, type Gender } from "@/lib/countries";
import { useAuthStore } from "@/stores/auth-store";

export default function SettingsTab(): JSX.Element {
  const params = useLocalSearchParams<{ focus?: string }>();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const paywallYRef = useRef(0);
  const profile = useAuthStore((state) => state.profile);
  const preferences = useAuthStore((state) => state.preferences);
  const subscription = useAuthStore((state) => state.subscription);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const updatePreferences = useAuthStore((state) => state.updatePreferences);
  const syncSubscription = useAuthStore((state) => state.syncSubscription);
  const signOut = useAuthStore((state) => state.signOut);
  const isPremium = useAuthStore((state) => state.isPremium());
  const [username, setUsername] = useState(profile?.username ?? "");
  const [interests, setInterests] = useState(profile?.interests.join(", ") ?? "");
  const [countryCode, setCountryCode] = useState(profile?.country_code ?? "IN");
  const [gender, setGender] = useState<Gender>(profile?.gender ?? "male");
  const [countryFilters, setCountryFilters] = useState<string[]>(
    preferences?.country_filters ?? [],
  );
  const [genderFilters, setGenderFilters] = useState<Gender[]>(
    preferences?.gender_filters ?? [],
  );
  const [interestFilters, setInterestFilters] = useState(
    preferences?.interest_filters.join(", ") ?? "",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (params.focus !== "paywall") {
      return;
    }

    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        animated: true,
        y: Math.max(paywallYRef.current - 16, 0),
      });
    }, 250);

    return () => clearTimeout(timeout);
  }, [params.focus]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await updateProfile({
        country_code: countryCode,
        gender,
        interests: interests
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 8),
        username: username.trim(),
      });

      await updatePreferences({
        country_filters: countryFilters,
        gender_filters: genderFilters,
        interest_filters: interestFilters
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 8),
      });

      Alert.alert("Saved", "Your settings were updated.");
    } catch (error) {
      Alert.alert(
        "Update failed",
        error instanceof Error ? error.message : "Unable to update settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleCountryFilter = (value: string): void => {
    if (!isPremium) {
      return;
    }

    setCountryFilters((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value].slice(0, 6),
    );
  };

  const toggleGenderFilter = (value: Gender): void => {
    if (!isPremium) {
      return;
    }

    setGenderFilters((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      contentContainerStyle={styles.content}
      style={styles.root}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <TextInput
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor="#708198"
          style={styles.input}
          value={username}
        />
        <TextInput
          multiline
          numberOfLines={3}
          onChangeText={setInterests}
          placeholder="Interests"
          placeholderTextColor="#708198"
          style={[styles.input, styles.multiline]}
          value={interests}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Country</Text>
        <View style={styles.grid}>
          {COUNTRY_OPTIONS.map((option) => (
            <SettingsChip
              active={countryCode === option.code}
              key={option.code}
              label={`${option.flag} ${option.name}`}
              onPress={() => setCountryCode(option.code)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gender</Text>
        <View style={styles.grid}>
          {GENDER_OPTIONS.map((option) => (
            <SettingsChip
              active={gender === option.value}
              key={option.value}
              label={option.label}
              onPress={() => setGender(option.value)}
            />
          ))}
        </View>
      </View>

      <View
        onLayout={(event) => {
          paywallYRef.current = event.nativeEvent.layout.y;
        }}
        style={styles.section}
      >
        <Text style={styles.sectionTitle}>Upgrade</Text>
        <PricingCard
          onRefreshSubscription={syncSubscription}
          subscription={subscription}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Premium filters</Text>
        <Text style={styles.sectionCopy}>
          Premium users can choose exact country, gender, and interest filters.
          Free users stay on local-country matching with controlled exceptions.
        </Text>

        <Text style={styles.subheading}>Country filters</Text>
        <View style={styles.grid}>
          {COUNTRY_OPTIONS.map((option) => (
            <SettingsChip
              active={countryFilters.includes(option.code)}
              disabled={!isPremium}
              key={option.code}
              label={option.code}
              onPress={() => toggleCountryFilter(option.code)}
            />
          ))}
        </View>

        <Text style={styles.subheading}>Gender filters</Text>
        <View style={styles.grid}>
          {GENDER_OPTIONS.map((option) => (
            <SettingsChip
              active={genderFilters.includes(option.value)}
              disabled={!isPremium}
              key={option.value}
              label={option.label}
              onPress={() => toggleGenderFilter(option.value)}
            />
          ))}
        </View>

        <Text style={styles.subheading}>Interest filters</Text>
        <TextInput
          editable={isPremium}
          onChangeText={setInterestFilters}
          placeholder="anime, travel, gaming"
          placeholderTextColor="#708198"
          style={[styles.input, !isPremium && styles.disabledInput]}
          value={interestFilters}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Safety</Text>
        <Text style={styles.sectionCopy}>
          Reports: {profile?.report_count ?? 0} / 10
          {profile?.banned_at
            ? " · Banned"
            : (profile?.report_count ?? 0) >= 5
              ? " · Warning active"
              : " · Account clear"}
        </Text>
      </View>

      <Pressable
        disabled={saving}
        onPress={handleSave}
        style={[styles.actionButton, styles.primaryButton]}
      >
        <Text style={styles.primaryButtonText}>
          {saving ? "Saving..." : "Save settings"}
        </Text>
      </Pressable>

      <Pressable onPress={() => void signOut()} style={styles.actionButton}>
        <Text style={styles.actionText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

interface SettingsChipProps {
  active: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}

function SettingsChip({
  active,
  disabled,
  label,
  onPress,
}: SettingsChipProps): JSX.Element {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        active && styles.chipActive,
        disabled && styles.chipDisabled,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    backgroundColor: "#121b2d",
    borderColor: "#1b2840",
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 56,
  },
  actionText: {
    color: "#dce5ef",
    fontSize: 15,
    fontWeight: "700",
  },
  chip: {
    backgroundColor: "#0d1628",
    borderColor: "#1b2840",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: "rgba(91, 230, 197, 0.14)",
    borderColor: "#5be6c5",
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    color: "#d0d8e5",
    fontSize: 13,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#f4fffd",
  },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: 32,
  },
  disabledInput: {
    opacity: 0.55,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  input: {
    backgroundColor: "#0d1628",
    borderColor: "#1b2840",
    borderRadius: 16,
    borderWidth: 1,
    color: "#f4f7fb",
    fontSize: 15,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: "#5be6c5",
    borderColor: "#5be6c5",
  },
  primaryButtonText: {
    color: "#07111f",
    fontSize: 15,
    fontWeight: "800",
  },
  root: {
    backgroundColor: "#07111f",
    flex: 1,
  },
  section: {
    backgroundColor: "#0d1628",
    borderColor: "#172033",
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  sectionCopy: {
    color: "#9dacbf",
    fontSize: 14,
    lineHeight: 21,
  },
  sectionTitle: {
    color: "#f4f7fb",
    fontSize: 20,
    fontWeight: "800",
  },
  subheading: {
    color: "#cdd8e4",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
});
