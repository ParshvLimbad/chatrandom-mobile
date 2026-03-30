import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { ReportReason } from "@/lib/domain";

interface ReportModalProps {
  onClose: () => void;
  onSubmit: (reason: ReportReason) => void;
  visible: boolean;
}

const REASONS: { label: string; value: ReportReason }[] = [
  { label: "Nudity", value: "nudity" },
  { label: "Harassment", value: "harassment" },
  { label: "Underage", value: "underage" },
  { label: "Spam", value: "spam" },
];

export function ReportModal({
  onClose,
  onSubmit,
  visible,
}: ReportModalProps): JSX.Element {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Report this user</Text>
          <Text style={styles.body}>
            Reports are logged against the authenticated account. Warnings are
            issued at 5 reports and bans at 10.
          </Text>
          <View style={styles.reasonList}>
            {REASONS.map((reason) => (
              <Pressable
                key={reason.value}
                onPress={() => onSubmit(reason.value)}
                style={styles.reasonButton}
              >
                <Text style={styles.reasonText}>{reason.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(3, 7, 15, 0.7)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  body: {
    color: "#9dacbf",
    fontSize: 14,
    lineHeight: 21,
  },
  cancelButton: {
    alignItems: "center",
    borderColor: "#21304c",
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  cancelText: {
    color: "#dce5ef",
    fontSize: 15,
    fontWeight: "700",
  },
  reasonButton: {
    backgroundColor: "#0f1830",
    borderColor: "#22324f",
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  reasonList: {
    gap: 10,
  },
  reasonText: {
    color: "#f4f7fb",
    fontSize: 15,
    fontWeight: "700",
  },
  sheet: {
    backgroundColor: "#0a1222",
    borderColor: "#172033",
    borderRadius: 28,
    borderWidth: 1,
    gap: 16,
    padding: 22,
    width: "100%",
  },
  title: {
    color: "#f4f7fb",
    fontSize: 22,
    fontWeight: "800",
  },
});
