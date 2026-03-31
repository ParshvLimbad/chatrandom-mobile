import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { addYears, differenceInYears, format } from "date-fns";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  COUNTRY_OPTIONS,
  GENDER_OPTIONS,
  type Gender,
} from "@/lib/countries";
import type { OnboardingInput } from "@/lib/domain";
import { useAuthStore } from "@/stores/auth-store";

const DEFAULT_DOB = addYears(new Date(), -20);

export default function OnboardingScreen(): JSX.Element {
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const saveOnboarding = useAuthStore((state) => state.saveOnboarding);
  const [username, setUsername] = useState(profile?.username ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(
    profile?.date_of_birth ? new Date(profile.date_of_birth) : DEFAULT_DOB,
  );
  const [gender, setGender] = useState<Gender>(profile?.gender ?? "male");
  const [countryCode, setCountryCode] = useState(profile?.country_code ?? "IN");
  const [interests, setInterests] = useState(
    profile?.interests.join(", ") ?? "",
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const age = useMemo(
    () => differenceInYears(new Date(), dateOfBirth),
    [dateOfBirth],
  );

  const handleDateChange = (
    event: DateTimePickerEvent,
    nextDate?: Date,
  ): void => {
    setShowDatePicker(false);
    if (event.type === "dismissed" || !nextDate) {
      return;
    }
    setDateOfBirth(nextDate);
  };

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== "android") {
      return true;
    }

    const permissions = [
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ];

    const result = await PermissionsAndroid.requestMultiple(permissions);
    const cameraGranted =
      result[PermissionsAndroid.PERMISSIONS.CAMERA] ===
      PermissionsAndroid.RESULTS.GRANTED;
    const micGranted =
      result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
      PermissionsAndroid.RESULTS.GRANTED;

    if (cameraGranted && micGranted) {
      return true;
    }

    Alert.alert(
      "Permissions required",
      "Camera and microphone access are required for video and voice matching. Text chat still works without them, and you can enable permissions from Android settings later.",
      [
        { style: "cancel", text: "Stay here" },
        {
          text: "Open settings",
          onPress: () => {
            void Linking.openSettings();
          },
        },
      ],
    );

    return false;
  };

  const handleContinue = async (): Promise<void> => {
    setErrorText(null);

    if (username.trim().length < 3) {
      setErrorText("Username must be at least 3 characters.");
      return;
    }

    if (age < 16) {
      setErrorText("Speaky is restricted to users who are 16 or older.");
      return;
    }

    const payload: OnboardingInput = {
      country_code: countryCode,
      date_of_birth: format(dateOfBirth, "yyyy-MM-dd"),
      gender,
      interests: interests
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8),
      username: username.trim(),
    };

    setIsSaving(true);
    try {
      await saveOnboarding(payload);
      await requestPermissions();
      router.replace("/video");
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Failed to save onboarding.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>SET UP PROFILE</Text>
          <Text style={styles.title}>Tell Speaky who you are.</Text>
          <Text style={styles.subtitle}>
            We use your profile for age gating, local-country free matching, and
            premium filters.
          </Text>
        </View>

        <FormField label="Username">
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setUsername}
            placeholder="Your public username"
            placeholderTextColor="#697b91"
            style={styles.input}
            value={username}
          />
        </FormField>

        <FormField label="Date of birth">
          <Pressable onPress={() => setShowDatePicker(true)} style={styles.inputButton}>
            <Text style={styles.inputButtonText}>
              {format(dateOfBirth, "dd MMM yyyy")} · {age} years old
            </Text>
          </Pressable>
          {showDatePicker ? (
            <DateTimePicker
              display="spinner"
              maximumDate={new Date()}
              minimumDate={new Date("1950-01-01")}
              mode="date"
              onChange={handleDateChange}
              value={dateOfBirth}
            />
          ) : null}
        </FormField>

        <FormField label="Gender">
          <View style={styles.chipGrid}>
            {GENDER_OPTIONS.map((option) => (
              <Chip
                active={gender === option.value}
                key={option.value}
                label={option.label}
                onPress={() => setGender(option.value)}
              />
            ))}
          </View>
        </FormField>

        <FormField label="Country">
          <View style={styles.chipGrid}>
            {COUNTRY_OPTIONS.map((option) => (
              <Chip
                active={countryCode === option.code}
                key={option.code}
                label={`${option.flag} ${option.name}`}
                onPress={() => setCountryCode(option.code)}
              />
            ))}
          </View>
        </FormField>

        <FormField label="Interests">
          <TextInput
            autoCapitalize="none"
            multiline
            numberOfLines={3}
            onChangeText={setInterests}
            placeholder="music, cricket, coding, anime"
            placeholderTextColor="#697b91"
            style={[styles.input, styles.multilineInput]}
            value={interests}
          />
        </FormField>

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <Pressable
          disabled={isSaving}
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            isSaving && styles.primaryButtonDisabled,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {isSaving ? "Saving..." : "Continue to Speaky"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

interface ChipProps {
  active: boolean;
  label: string;
  onPress: () => void;
}

function Chip({ active, label, onPress }: ChipProps): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

interface FormFieldProps {
  children: ReactNode;
  label: string;
}

function FormField({ children, label }: FormFieldProps): JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: "#0d1628",
    borderColor: "#1b2840",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chipActive: {
    backgroundColor: "rgba(91, 230, 197, 0.14)",
    borderColor: "#5be6c5",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chipText: {
    color: "#d0d8e5",
    fontSize: 14,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#f4fffd",
  },
  content: {
    gap: 20,
    padding: 20,
    paddingBottom: 40,
  },
  errorText: {
    color: "#ff9aa0",
    fontSize: 14,
    lineHeight: 20,
  },
  eyebrow: {
    color: "#5be6c5",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 3,
  },
  field: {
    gap: 10,
  },
  header: {
    gap: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#0d1628",
    borderColor: "#1b2840",
    borderRadius: 16,
    borderWidth: 1,
    color: "#f4f7fb",
    fontSize: 15,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  inputButton: {
    backgroundColor: "#0d1628",
    borderColor: "#1b2840",
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: 16,
  },
  inputButtonText: {
    color: "#f4f7fb",
    fontSize: 15,
    fontWeight: "600",
  },
  label: {
    color: "#c8d2dd",
    fontSize: 15,
    fontWeight: "700",
  },
  multilineInput: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#5be6c5",
    borderRadius: 18,
    justifyContent: "center",
    minHeight: 58,
    marginTop: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonPressed: {
    opacity: 0.86,
  },
  primaryButtonText: {
    color: "#07111f",
    fontSize: 16,
    fontWeight: "800",
  },
  safeArea: {
    backgroundColor: "#07111f",
    flex: 1,
  },
  subtitle: {
    color: "#9dacbf",
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: "#f4f7fb",
    fontSize: 30,
    fontWeight: "800",
  },
});
