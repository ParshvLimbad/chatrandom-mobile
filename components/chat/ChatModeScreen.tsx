import { formatDistanceToNowStrict } from "date-fns";
import { captureRef } from "react-native-view-shot";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { RTCView } from "react-native-webrtc";

import { AdBanner } from "@/components/ads/AdBanner";
import { AudioWave } from "@/components/chat/AudioWave";
import { ReportModal } from "@/components/chat/ReportModal";
import type { ChatMode, ReportReason } from "@/lib/domain";
import { classifyCapturedFrame, isExplicitContent } from "@/lib/moderation";
import { useRandomChat } from "@/hooks/useRandomChat";

interface ChatModeScreenProps {
  mode: ChatMode;
}

function getModeTitle(mode: ChatMode): string {
  if (mode === "video") {
    return "Video";
  }
  if (mode === "voice") {
    return "Voice";
  }
  return "Text";
}

export function ChatModeScreen({ mode }: ChatModeScreenProps): JSX.Element {
  const {
    bannerText,
    canToggleCamera,
    connectedLongEnough,
    currentDraft,
    isCameraEnabled,
    isMicMuted,
    joinQueue,
    leaveChat,
    localStream,
    match,
    messages,
    permissionError,
    quality,
    queueStatus,
    remoteStream,
    reportUser,
    secondsConnected,
    sendMessage,
    setCurrentDraft,
    shouldShowBannerAd,
    skipCurrent,
    statusText,
    strangerTyping,
    toggleCamera,
    toggleMic,
  } = useRandomChat(mode);
  const stageRef = useRef<View | null>(null);
  const messageScrollRef = useRef<ScrollView | null>(null);
  const moderationLockRef = useRef(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const localStreamUrl = localStream?.toURL();
  const remoteStreamUrl = remoteStream?.toURL();
  const connectionTimerText = useMemo(() => {
    if (!match) {
      return "00s";
    }

    return `${String(secondsConnected).padStart(2, "0")}s`;
  }, [match, secondsConnected]);

  useEffect(() => {
    messageScrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, strangerTyping]);

  useEffect(() => {
    moderationLockRef.current = false;
  }, [match?.roomId]);

  useEffect(() => {
    if (mode !== "video" || !match || !remoteStreamUrl) {
      return;
    }

    const interval = setInterval(async () => {
      if (moderationLockRef.current || !stageRef.current) {
        return;
      }

      try {
        const uri = await captureRef(stageRef, {
          format: "jpg",
          quality: 0.65,
          result: "tmpfile",
        });
        const predictions = await classifyCapturedFrame(uri);
        if (isExplicitContent(predictions)) {
          moderationLockRef.current = true;
          reportUser("nudity", "moderation");
          skipCurrent("moderation");
        }
      } catch {
        // Ignore intermittent capture/model errors during live sessions.
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [match, mode, remoteStreamUrl, reportUser, skipCurrent]);

  const handleReport = (reason: ReportReason): void => {
    setReportModalVisible(false);
    reportUser(reason, "manual");
    if (reason === "nudity") {
      skipCurrent("moderation");
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={styles.root}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          style={styles.scroll}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>{getModeTitle(mode).toUpperCase()} TAB</Text>
              <Text style={styles.title}>Random {getModeTitle(mode).toLowerCase()} chat</Text>
            </View>
            <View style={styles.statusBlock}>
              <Text style={styles.statusText}>{statusText}</Text>
              <View style={styles.metaRow}>
                <Text
                  style={[
                    styles.timerText,
                    connectedLongEnough && styles.timerTextActive,
                  ]}
                >
                  {connectionTimerText}
                </Text>
                <View
                  style={[
                    styles.qualityDot,
                    quality === "excellent" && styles.qualityExcellent,
                    quality === "fair" && styles.qualityFair,
                    quality === "poor" && styles.qualityPoor,
                  ]}
                />
              </View>
            </View>
          </View>

          {bannerText ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{bannerText}</Text>
            </View>
          ) : null}

          {permissionError && mode !== "text" ? (
            <View style={styles.permissionCard}>
              <Text style={styles.permissionTitle}>Permissions blocked</Text>
              <Text style={styles.permissionBody}>{permissionError}</Text>
              <Pressable
                onPress={() => {
                  void Linking.openSettings();
                }}
                style={styles.permissionButton}
              >
                <Text style={styles.permissionButtonText}>Open settings</Text>
              </Pressable>
            </View>
          ) : null}

          <View ref={stageRef} style={styles.stage}>
            {mode === "video" ? (
              <>
                {remoteStreamUrl ? (
                  <RTCView
                    mirror={false}
                    objectFit="cover"
                    streamURL={remoteStreamUrl}
                    style={styles.remoteVideo}
                  />
                ) : (
                  <View style={styles.placeholderStage}>
                    <Text style={styles.placeholderTitle}>
                      {queueStatus === "matched"
                        ? "Connecting video..."
                        : "Finding your next camera match"}
                    </Text>
                    <Text style={styles.placeholderBody}>
                      Speaky keeps you in the matchmaking flow automatically.
                    </Text>
                  </View>
                )}
                {localStreamUrl ? (
                  <RTCView
                    mirror
                    objectFit="cover"
                    streamURL={localStreamUrl}
                    style={styles.localVideo}
                  />
                ) : null}
              </>
            ) : mode === "voice" ? (
              <View style={styles.voiceStage}>
                <Text style={styles.voiceTitle}>
                  {match ? "Voice link active" : "Waiting for a voice stranger"}
                </Text>
                <AudioWave active={Boolean(match)} />
                <Text style={styles.voiceMeta}>
                  {match
                    ? `${match.partner.country_code} · ${match.partner.gender}`
                    : "Mic-only matching keeps audio fast and light."}
                </Text>
              </View>
            ) : (
              <View style={styles.textStage}>
                <Text style={styles.textStageTitle}>
                  {match ? "Text session live" : "Queueing for text chat"}
                </Text>
                <Text style={styles.textStageBody}>
                  {match
                    ? `Matched ${formatDistanceToNowStrict(
                        new Date(match.matchedAt),
                        { addSuffix: true },
                      )}`
                    : "Free users stay local-first. Premium unlocks exact filters."}
                </Text>
              </View>
            )}
          </View>

          {match ? (
            <View style={styles.partnerCard}>
              <Text style={styles.partnerTitle}>Matched profile</Text>
              <Text style={styles.partnerBody}>
                {match.partner.country_code} · {match.partner.gender}
              </Text>
              <Text style={styles.partnerTags}>
                {match.partner.interests.length > 0
                  ? match.partner.interests.join(" • ")
                  : "No shared interests returned"}
              </Text>
            </View>
          ) : null}

          {shouldShowBannerAd ? (
            <View style={styles.adContainer}>
              <AdBanner />
            </View>
          ) : null}

          <View style={styles.controls}>
            <ControlButton
              active={!isMicMuted}
              label={isMicMuted ? "Unmute" : "Mute"}
              onPress={toggleMic}
            />
            {canToggleCamera ? (
              <ControlButton
                active={isCameraEnabled}
                label={isCameraEnabled ? "Camera On" : "Camera Off"}
                onPress={toggleCamera}
              />
            ) : null}
            <ControlButton label="NEXT" onPress={() => skipCurrent("manual")} primary />
            <ControlButton label="Leave" onPress={leaveChat} />
            <ControlButton disabled label="Boost" onPress={() => undefined} />
            <ControlButton
              label="Report"
              onPress={() => setReportModalVisible(true)}
            />
          </View>

          {!match && queueStatus === "idle" ? (
            <Pressable onPress={joinQueue} style={styles.rejoinButton}>
              <Text style={styles.rejoinButtonText}>Start matching</Text>
            </Pressable>
          ) : null}

          <View style={styles.chatCard}>
            <Text style={styles.chatTitle}>Live chat</Text>
            <ScrollView
              ref={messageScrollRef}
              contentContainerStyle={styles.messageList}
              style={styles.messageScroll}
            >
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageBubble,
                    message.sender === "self"
                      ? styles.selfBubble
                      : styles.strangerBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      message.sender === "self" && styles.selfMessageText,
                    ]}
                  >
                    {message.text}
                  </Text>
                  <Text style={styles.messageMeta}>
                    {formatDistanceToNowStrict(new Date(message.timestamp), {
                      addSuffix: true,
                    })}
                  </Text>
                </View>
              ))}
              {strangerTyping ? (
                <Text style={styles.typingText}>Stranger is typing...</Text>
              ) : null}
            </ScrollView>
            <View style={styles.composer}>
              <TextInput
                onChangeText={setCurrentDraft}
                placeholder="Type a message"
                placeholderTextColor="#708198"
                style={styles.composerInput}
                value={currentDraft}
              />
              <Pressable
                onPress={() => sendMessage(currentDraft)}
                style={styles.sendButton}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ReportModal
        onClose={() => setReportModalVisible(false)}
        onSubmit={handleReport}
        visible={reportModalVisible}
      />
    </>
  );
}

interface ControlButtonProps {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  primary?: boolean;
}

function ControlButton({
  active = false,
  disabled = false,
  label,
  onPress,
  primary = false,
}: ControlButtonProps): JSX.Element {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.controlButton,
        active && styles.controlButtonActive,
        primary && styles.controlButtonPrimary,
        disabled && styles.controlButtonDisabled,
      ]}
    >
      <Text
        style={[
          styles.controlText,
          active && styles.controlTextActive,
          primary && styles.controlTextPrimary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  adContainer: {
    alignItems: "center",
    backgroundColor: "#0d1628",
    borderColor: "#172033",
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: 10,
  },
  banner: {
    backgroundColor: "rgba(255, 154, 160, 0.12)",
    borderColor: "rgba(255, 154, 160, 0.26)",
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  bannerText: {
    color: "#ffd4d8",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  chatCard: {
    backgroundColor: "#0d1628",
    borderColor: "#172033",
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  chatTitle: {
    color: "#f4f7fb",
    fontSize: 18,
    fontWeight: "800",
  },
  composer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  composerInput: {
    backgroundColor: "#121b2d",
    borderColor: "#1d2942",
    borderRadius: 16,
    borderWidth: 1,
    color: "#f4f7fb",
    flex: 1,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  connectedBadge: {
    color: "#5be6c5",
  },
  content: {
    gap: 18,
    padding: 18,
    paddingBottom: 32,
  },
  controlButton: {
    alignItems: "center",
    backgroundColor: "#121b2d",
    borderColor: "#1f2b44",
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 88,
    paddingHorizontal: 14,
  },
  controlButtonActive: {
    borderColor: "#5be6c5",
  },
  controlButtonDisabled: {
    opacity: 0.45,
  },
  controlButtonPrimary: {
    backgroundColor: "#5be6c5",
    borderColor: "#5be6c5",
  },
  controlText: {
    color: "#dce5ef",
    fontSize: 14,
    fontWeight: "800",
  },
  controlTextActive: {
    color: "#f4fffd",
  },
  controlTextPrimary: {
    color: "#07111f",
  },
  controls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  eyebrow: {
    color: "#5be6c5",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.4,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  localVideo: {
    borderColor: "#5be6c5",
    borderRadius: 18,
    borderWidth: 2,
    bottom: 14,
    height: 128,
    position: "absolute",
    right: 14,
    width: 92,
  },
  messageBubble: {
    borderRadius: 18,
    gap: 4,
    maxWidth: "90%",
    padding: 12,
  },
  messageList: {
    gap: 10,
  },
  messageMeta: {
    color: "#8f9db1",
    fontSize: 11,
    fontWeight: "600",
  },
  messageScroll: {
    maxHeight: 260,
  },
  messageText: {
    color: "#f4f7fb",
    fontSize: 15,
    lineHeight: 21,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  partnerBody: {
    color: "#d9e2ed",
    fontSize: 15,
    fontWeight: "700",
  },
  partnerCard: {
    backgroundColor: "#0d1628",
    borderColor: "#172033",
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  partnerTags: {
    color: "#96a6b9",
    fontSize: 13,
    lineHeight: 19,
  },
  partnerTitle: {
    color: "#f4f7fb",
    fontSize: 18,
    fontWeight: "800",
  },
  permissionBody: {
    color: "#9dacbf",
    fontSize: 14,
    lineHeight: 21,
  },
  permissionButton: {
    alignItems: "center",
    backgroundColor: "#5be6c5",
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 48,
  },
  permissionButtonText: {
    color: "#07111f",
    fontSize: 15,
    fontWeight: "800",
  },
  permissionCard: {
    backgroundColor: "#0d1628",
    borderColor: "#172033",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  permissionTitle: {
    color: "#f4f7fb",
    fontSize: 18,
    fontWeight: "800",
  },
  placeholderBody: {
    color: "#9dacbf",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  placeholderStage: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  placeholderTitle: {
    color: "#f4f7fb",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  qualityDot: {
    backgroundColor: "#4e5b70",
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  qualityExcellent: {
    backgroundColor: "#5be6c5",
  },
  qualityFair: {
    backgroundColor: "#f8be5c",
  },
  qualityPoor: {
    backgroundColor: "#ff8d95",
  },
  rejoinButton: {
    alignItems: "center",
    backgroundColor: "#5be6c5",
    borderRadius: 18,
    justifyContent: "center",
    minHeight: 54,
  },
  rejoinButtonText: {
    color: "#07111f",
    fontSize: 15,
    fontWeight: "800",
  },
  remoteVideo: {
    flex: 1,
  },
  root: {
    backgroundColor: "#07111f",
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  selfBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#5be6c5",
  },
  selfMessageText: {
    color: "#07111f",
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: "#5be6c5",
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 50,
    minWidth: 82,
  },
  sendButtonText: {
    color: "#07111f",
    fontSize: 15,
    fontWeight: "800",
  },
  stage: {
    backgroundColor: "#09111f",
    borderColor: "#172033",
    borderRadius: 30,
    borderWidth: 1,
    height: 360,
    overflow: "hidden",
  },
  statusBlock: {
    alignItems: "flex-end",
    gap: 6,
  },
  statusText: {
    color: "#f4f7fb",
    fontSize: 14,
    fontWeight: "700",
  },
  strangerBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#121b2d",
  },
  textStage: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  textStageBody: {
    color: "#9dacbf",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    textAlign: "center",
  },
  textStageTitle: {
    color: "#f4f7fb",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  timerText: {
    color: "#9cacbe",
    fontSize: 14,
    fontWeight: "800",
  },
  timerTextActive: {
    color: "#5be6c5",
  },
  title: {
    color: "#f4f7fb",
    fontSize: 28,
    fontWeight: "800",
  },
  typingText: {
    color: "#96a6b9",
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 4,
  },
  voiceMeta: {
    color: "#a7b4c4",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 18,
    textAlign: "center",
  },
  voiceStage: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  voiceTitle: {
    color: "#f4f7fb",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 18,
    textAlign: "center",
  },
});
