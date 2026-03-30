import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type MediaStream } from "react-native-webrtc";

import type {
  ChatMessage,
  ChatMode,
  MatchSession,
  MatchStatus,
  ReportReason,
} from "@/lib/domain";
import { env } from "@/lib/env";
import {
  type ClientEnvelope,
  type MatchFilterRequest,
  SIGNALING_EVENT,
  type ServerEnvelope,
  type StatusPayload,
} from "@/lib/protocol";
import { useAuthStore } from "@/stores/auth-store";
import { useInterstitialAd } from "@/hooks/useInterstitialAd";
import { useWebRTC } from "@/hooks/useWebRTC";

interface UseRandomChatResult {
  bannerText: string | null;
  canToggleCamera: boolean;
  connectedLongEnough: boolean;
  currentDraft: string;
  isCameraEnabled: boolean;
  isMicMuted: boolean;
  joinQueue: () => void;
  leaveChat: () => void;
  localStream: MediaStream | null;
  match: MatchSession | null;
  messages: ChatMessage[];
  permissionError: string | null;
  quality: ReturnType<typeof useWebRTC>["quality"];
  queueStatus: MatchStatus;
  remoteStream: MediaStream | null;
  reportUser: (reason: ReportReason, source?: "manual" | "moderation") => void;
  secondsConnected: number;
  sendMessage: (text: string) => void;
  setCurrentDraft: (value: string) => void;
  setTyping: (isTyping: boolean) => void;
  shouldShowBannerAd: boolean;
  skipCurrent: (reason?: "manual" | "moderation") => void;
  statusText: string;
  strangerTyping: boolean;
  toggleCamera: () => void;
  toggleMic: () => void;
}

function buildSocketUrl(baseUrl: string): string {
  const withPath = baseUrl.endsWith("/ws")
    ? baseUrl
    : `${baseUrl.replace(/\/$/, "")}/ws`;
  return withPath.replace(/^http/, "ws");
}

function createEnvelope<TType extends ClientEnvelope["type"]>(
  type: TType,
  payload: Extract<ClientEnvelope, { type: TType }>["payload"],
): string {
  return JSON.stringify({ payload, type });
}

function isServerEnvelope(value: unknown): value is ServerEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "payload" in value && "type" in value;
}

export function useRandomChat(mode: ChatMode): UseRandomChatResult {
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const preferences = useAuthStore((state) => state.preferences);
  const isPremium = useAuthStore((state) => state.isPremium());
  const refreshAccount = useAuthStore((state) => state.syncSubscription);
  const [match, setMatch] = useState<MatchSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [statusText, setStatusText] = useState("Connecting...");
  const [queueStatus, setQueueStatus] = useState<MatchStatus>("idle");
  const [strangerTyping, setStrangerTyping] = useState(false);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [currentDraft, setCurrentDraft] = useState("");
  const [secondsConnected, setSecondsConnected] = useState(0);
  const [socketReady, setSocketReady] = useState(false);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const joinAttemptsRef = useRef(0);
  const shouldAutoJoinRef = useRef(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showInterstitial = useInterstitialAd(!isPremium);

  const sendSignal = useCallback((payload: Extract<ClientEnvelope, { type: "signal" }>["payload"]) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(createEnvelope(SIGNALING_EVENT.SIGNAL, payload));
  }, []);

  const onIceFailure = useCallback(
    (roomId: string) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      socket.send(createEnvelope(SIGNALING_EVENT.ICE_FAILED, { roomId }));
    },
    [],
  );

  const {
    cleanupPeerSession,
    handleSignal,
    initializeMatch,
    isCameraEnabled,
    isMicMuted,
    localStream,
    permissionError,
    quality,
    remoteStream,
    setRemoteDisconnected,
    toggleCamera,
    toggleMic,
  } = useWebRTC({
    mode,
    onIceFailure,
    onSignal: sendSignal,
  });

  const filterPayload = useMemo<MatchFilterRequest>(
    () => ({
      countryFilters: isPremium ? (preferences?.country_filters ?? []) : [],
      genderFilters: isPremium ? (preferences?.gender_filters ?? []) : [],
      interestFilters: isPremium ? (preferences?.interest_filters ?? []) : [],
    }),
    [isPremium, preferences?.country_filters, preferences?.gender_filters, preferences?.interest_filters],
  );

  const sendJoinQueue = useCallback(() => {
    const socket = socketRef.current;
    if (
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      !session?.access_token ||
      !profile ||
      profile.banned_at
    ) {
      return;
    }

    if (mode !== "text" && !localStream) {
      return;
    }

    joinAttemptsRef.current += 1;
    if (!isPremium && joinAttemptsRef.current % 5 === 0) {
      showInterstitial();
    }

    socket.send(
      createEnvelope(SIGNALING_EVENT.JOIN_QUEUE, {
        accessToken: session.access_token,
        filters: filterPayload,
        mode,
      }),
    );
    setBannerText(null);
    setMessages([]);
    setMatch(null);
    setQueueStatus("searching");
    setStatusText("Looking for someone...");
  }, [filterPayload, isPremium, localStream, mode, profile, session?.access_token, showInterstitial]);

  const joinQueue = useCallback(() => {
    shouldAutoJoinRef.current = true;
    sendJoinQueue();
  }, [sendJoinQueue]);

  const leaveChat = useCallback(() => {
    shouldAutoJoinRef.current = false;
    cleanupPeerSession();
    setMatch(null);
    setQueueStatus("idle");
    setStatusText("Chat ended.");
    setMessages([]);
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(createEnvelope(SIGNALING_EVENT.LEAVE, { reason: "manual" }));
    }
  }, [cleanupPeerSession]);

  const skipCurrent = useCallback(
    (reason: "manual" | "moderation" = "manual") => {
      shouldAutoJoinRef.current = true;
      cleanupPeerSession();
      setMatch(null);
      setMessages([]);
      setQueueStatus("searching");
      setStatusText("Finding your next match...");
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(createEnvelope(SIGNALING_EVENT.SKIP, { reason }));
      }
    },
    [cleanupPeerSession],
  );

  const reportUser = useCallback(
    (reason: ReportReason, source: "manual" | "moderation" = "manual") => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !match) {
        return;
      }

      socket.send(createEnvelope(SIGNALING_EVENT.REPORT_USER, { reason, source }));
    },
    [match],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !match) {
        return;
      }

      const timestamp = new Date().toISOString();
      setMessages((current) => [
        ...current,
        {
          id: `${timestamp}-self`,
          sender: "self",
          text: trimmed,
          timestamp,
        },
      ]);

      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(createEnvelope(SIGNALING_EVENT.CHAT_MESSAGE, { text: trimmed, timestamp }));
      }
      setCurrentDraft("");
    },
    [match],
  );

  const setTyping = useCallback((isTyping: boolean) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !match) {
      return;
    }

    socket.send(createEnvelope(SIGNALING_EVENT.TYPING_STATE, { isTyping }));
  }, [match]);

  useEffect(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (!match) {
      return;
    }

    setTyping(currentDraft.trim().length > 0);
    typingTimerRef.current = setTimeout(() => {
      setTyping(false);
    }, 1200);

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, [currentDraft, match, setTyping]);

  useEffect(() => {
    if (!session || !profile) {
      return;
    }

    if (profile.banned_at) {
      setBannerText("Your account has been banned from matchmaking.");
      setQueueStatus("idle");
      return;
    }

    const socket = new WebSocket(buildSocketUrl(env.workerUrl));
    socketRef.current = socket;
    setStatusText("Connecting...");

    socket.onopen = () => {
      setSocketReady(true);
      setStatusText("Connected to Speaky.");
      if (shouldAutoJoinRef.current) {
        sendJoinQueue();
      }
    };

    socket.onmessage = (event) => {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(event.data as string);
      } catch {
        setBannerText("Received malformed signaling payload.");
        return;
      }

      if (!isServerEnvelope(parsed)) {
        return;
      }

      switch (parsed.type) {
        case SIGNALING_EVENT.STATUS: {
          const payload = parsed.payload as StatusPayload;
          setStatusText(payload.message);
          if (payload.kind === "error") {
            setBannerText(payload.message);
          }
          break;
        }
        case SIGNALING_EVENT.QUEUE_STATE:
          setQueueStatus(parsed.payload.status);
          break;
        case SIGNALING_EVENT.MATCHED: {
          const nextMatch: MatchSession = {
            ad_eligible: parsed.payload.adEligible,
            initiator: parsed.payload.initiator,
            matchedAt: parsed.payload.matchedAt,
            partner: parsed.payload.partner,
            roomId: parsed.payload.roomId,
          };
          setMatch(nextMatch);
          setMessages([]);
          setStrangerTyping(false);
          setQueueStatus("matched");
          setStatusText("Connected!");
          void initializeMatch(nextMatch);
          break;
        }
        case SIGNALING_EVENT.SIGNAL:
          void handleSignal(parsed.payload);
          break;
        case SIGNALING_EVENT.CHAT_MESSAGE: {
          const timestamp = parsed.payload.timestamp;
          setMessages((current) => [
            ...current,
            {
              id: `${timestamp}-stranger`,
              sender: "stranger",
              text: parsed.payload.text,
              timestamp,
            },
          ]);
          break;
        }
        case SIGNALING_EVENT.TYPING_STATE:
          setStrangerTyping(parsed.payload.isTyping);
          break;
        case SIGNALING_EVENT.REQUEUED:
          cleanupPeerSession();
          setMatch(null);
          setMessages([]);
          setQueueStatus("searching");
          setStatusText("Finding your next match...");
          break;
        case SIGNALING_EVENT.REPORT_ACK:
          setBannerText("Report submitted. Thanks for helping keep Speaky safe.");
          break;
        case SIGNALING_EVENT.STRANGER_DISCONNECTED:
          setBannerText("Stranger disconnected. Requeueing...");
          setMatch(null);
          setMessages([]);
          setStrangerTyping(false);
          setRemoteDisconnected();
          setQueueStatus("searching");
          break;
        case SIGNALING_EVENT.WARNING:
          setBannerText(
            `Warning: your account has ${parsed.payload.reportCount} reports.`,
          );
          void refreshAccount();
          break;
        case SIGNALING_EVENT.BANNED:
        case SIGNALING_EVENT.FORCE_DISCONNECT:
          shouldAutoJoinRef.current = false;
          setBannerText("Your account has been banned from matchmaking.");
          setQueueStatus("idle");
          setMatch(null);
          cleanupPeerSession();
          void refreshAccount();
          break;
        case SIGNALING_EVENT.ERROR:
          setBannerText(parsed.payload.message);
          break;
        default:
          break;
      }
    };

    socket.onclose = () => {
      setSocketReady(false);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      reconnectTimerRef.current = setTimeout(() => {
        if (shouldAutoJoinRef.current) {
          setStatusText("Reconnecting...");
          setReconnectNonce((current) => current + 1);
        }
      }, 1500);
    };

    return () => {
      setSocketReady(false);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      socket.close();
      socketRef.current = null;
    };
  }, [
    cleanupPeerSession,
    handleSignal,
    initializeMatch,
    profile,
    reconnectNonce,
    refreshAccount,
    sendJoinQueue,
    session,
    setRemoteDisconnected,
  ]);

  useEffect(() => {
    if (!socketReady) {
      return;
    }

    if (shouldAutoJoinRef.current) {
      sendJoinQueue();
    }
  }, [mode, sendJoinQueue, socketReady]);

  useEffect(() => {
    if (!match) {
      setSecondsConnected(0);
      return;
    }

    const matchedAt = new Date(match.matchedAt).getTime();
    const interval = setInterval(() => {
      const nextSeconds = Math.max(
        0,
        Math.floor((Date.now() - matchedAt) / 1000),
      );
      setSecondsConnected(nextSeconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [match]);

  const shouldShowBannerAd =
    !isPremium && socketReady && (mode === "text" || !match);

  return {
    bannerText,
    canToggleCamera: mode === "video",
    connectedLongEnough: secondsConnected >= 15,
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
    setTyping,
    shouldShowBannerAd,
    skipCurrent,
    statusText,
    strangerTyping,
    toggleCamera,
    toggleMic,
  };
}
