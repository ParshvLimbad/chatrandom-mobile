import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from "react-native-webrtc";

import type {
  ChatMode,
  MatchSession,
  QualityLevel,
} from "@/lib/domain";
import type { SignalPayload } from "@/lib/protocol";

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface UseWebRTCOptions {
  mode: ChatMode;
  onIceFailure: (roomId: string) => void;
  onSignal: (payload: SignalPayload) => void;
}

interface StatsReportLike {
  currentRoundTripTime?: number;
  state?: string;
  type?: string;
}

interface TrackEventLike {
  streams: MediaStream[];
}

interface IceCandidateEventLike {
  candidate: RTCIceCandidate | null;
}

interface PeerConnectionWithEvents extends RTCPeerConnection {
  onicecandidate?: (event: IceCandidateEventLike) => void;
  oniceconnectionstatechange?: () => void;
  ontrack?: (event: TrackEventLike) => void;
}

export interface UseWebRTCResult {
  cleanupPeerSession: () => void;
  handleSignal: (payload: SignalPayload) => Promise<void>;
  initializeMatch: (session: MatchSession) => Promise<void>;
  isCameraEnabled: boolean;
  isMicMuted: boolean;
  localStream: MediaStream | null;
  permissionError: string | null;
  quality: QualityLevel;
  remoteStream: MediaStream | null;
  setRemoteDisconnected: () => void;
  stopAllMedia: () => void;
  toggleCamera: () => void;
  toggleMic: () => void;
}

type ConnectionStats =
  | Map<string, unknown>
  | unknown[]
  | Record<string, unknown>
  | null
  | undefined;

function normaliseStats(stats: ConnectionStats): StatsReportLike[] {
  if (!stats) {
    return [];
  }

  if (Array.isArray(stats)) {
    return stats as StatsReportLike[];
  }

  if (stats instanceof Map) {
    return Array.from(stats.values()) as StatsReportLike[];
  }

  return Object.values(stats) as StatsReportLike[];
}

export function useWebRTC({
  mode,
  onIceFailure,
  onSignal,
}: UseWebRTCOptions): UseWebRTCResult {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(mode === "video");
  const [quality, setQuality] = useState<QualityLevel>("unknown");

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const currentSessionRef = useRef<MatchSession | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceFailureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopStatsLoop = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  }, []);

  const clearIceFailureTimer = useCallback(() => {
    if (iceFailureTimerRef.current) {
      clearTimeout(iceFailureTimerRef.current);
      iceFailureTimerRef.current = null;
    }
  }, []);

  const cleanupPeerSession = useCallback(() => {
    clearIceFailureTimer();
    stopStatsLoop();
    currentSessionRef.current = null;
    setQuality("unknown");

    remoteStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    remoteStreamRef.current = null;
    setRemoteStream(null);

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
  }, [clearIceFailureTimer, stopStatsLoop]);

  const stopAllMedia = useCallback(() => {
    cleanupPeerSession();
    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    localStreamRef.current = null;
    setLocalStream(null);
  }, [cleanupPeerSession]);

  const startStatsLoop = useCallback(
    (peerConnection: RTCPeerConnection) => {
      stopStatsLoop();
      statsIntervalRef.current = setInterval(async () => {
        const stats = (await peerConnection.getStats()) as ConnectionStats;
        let qualityValue: QualityLevel = "unknown";

        for (const report of normaliseStats(stats)) {
          if (
            report.type === "candidate-pair" &&
            report.state === "succeeded" &&
            typeof report.currentRoundTripTime === "number"
          ) {
            if (report.currentRoundTripTime < 0.15) {
              qualityValue = "excellent";
            } else if (report.currentRoundTripTime < 0.35) {
              qualityValue = "fair";
            } else {
              qualityValue = "poor";
            }
          }
        }

        setQuality(qualityValue);
      }, 4000);
    },
    [stopStatsLoop],
  );

  const attachLocalTracks = useCallback((peerConnection: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }

    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });
  }, []);

  const createPeerConnection = useCallback(
    (session: MatchSession): RTCPeerConnection => {
      cleanupPeerSession();

      const peerConnection = new RTCPeerConnection({
        iceServers: STUN_SERVERS,
      }) as PeerConnectionWithEvents;

      const nextRemoteStream = new MediaStream();
      remoteStreamRef.current = nextRemoteStream;
      setRemoteStream(nextRemoteStream);

      peerConnection.ontrack = (event: TrackEventLike) => {
        event.streams[0]?.getTracks().forEach((track) => {
          if (!remoteStreamRef.current?.getTrackById(track.id)) {
            remoteStreamRef.current?.addTrack(track);
          }
        });

        if (remoteStreamRef.current) {
          const refreshedStream = new MediaStream();
          remoteStreamRef.current.getTracks().forEach((track) => {
            refreshedStream.addTrack(track);
          });
          setRemoteStream(refreshedStream);
        }
      };

      peerConnection.onicecandidate = (event: IceCandidateEventLike) => {
        if (!event.candidate) {
          return;
        }

        onSignal({
          candidate: event.candidate.toJSON(),
          kind: "ice_candidate",
          roomId: session.roomId,
        });
      };

      peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        if (state === "connected" || state === "completed") {
          clearIceFailureTimer();
          startStatsLoop(peerConnection);
        }

        if (state === "failed" || state === "disconnected") {
          clearIceFailureTimer();
          iceFailureTimerRef.current = setTimeout(() => {
            if (
              peerConnection.iceConnectionState === "failed" ||
              peerConnection.iceConnectionState === "disconnected"
            ) {
              onIceFailure(session.roomId);
            }
          }, 5000);
        }
      };

      attachLocalTracks(peerConnection);
      peerConnectionRef.current = peerConnection;
      currentSessionRef.current = session;

      return peerConnection;
    },
    [
      attachLocalTracks,
      cleanupPeerSession,
      clearIceFailureTimer,
      onIceFailure,
      onSignal,
      startStatsLoop,
    ],
  );

  const initializeMatch = useCallback(
    async (session: MatchSession) => {
      if (mode === "text") {
        currentSessionRef.current = session;
        return;
      }

      const peerConnection = createPeerConnection(session);
      if (session.initiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        onSignal({
          description: offer,
          kind: "offer",
          roomId: session.roomId,
        });
      }
    },
    [createPeerConnection, mode, onSignal],
  );

  const handleSignal = useCallback(
    async (payload: SignalPayload) => {
      const session = currentSessionRef.current;
      if (!session || payload.roomId !== session.roomId || mode === "text") {
        return;
      }

      const peerConnection =
        peerConnectionRef.current ?? createPeerConnection(session);

      if (
        payload.kind === "offer" &&
        payload.description?.sdp &&
        payload.description.type
      ) {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription({
            sdp: payload.description.sdp,
            type: payload.description.type,
          }),
        );
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        onSignal({
          description: answer,
          kind: "answer",
          roomId: session.roomId,
        });
        return;
      }

      if (
        payload.kind === "answer" &&
        payload.description?.sdp &&
        payload.description.type
      ) {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription({
            sdp: payload.description.sdp,
            type: payload.description.type,
          }),
        );
        return;
      }

      if (payload.kind === "ice_candidate" && payload.candidate) {
        await peerConnection.addIceCandidate(
          new RTCIceCandidate(payload.candidate),
        );
      }
    },
    [createPeerConnection, mode, onSignal],
  );

  const toggleMic = useCallback(() => {
    if (!localStream) {
      return;
    }

    const nextMuted = !isMicMuted;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMicMuted(nextMuted);
  }, [isMicMuted, localStream]);

  const toggleCamera = useCallback(() => {
    if (mode !== "video" || !localStream) {
      return;
    }

    const nextEnabled = !isCameraEnabled;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsCameraEnabled(nextEnabled);
  }, [isCameraEnabled, localStream, mode]);

  const setRemoteDisconnected = useCallback(() => {
    cleanupPeerSession();
  }, [cleanupPeerSession]);

  useEffect(() => {
    let active = true;

    const startMedia = async (): Promise<void> => {
      if (mode === "text") {
        setPermissionError(null);
        return;
      }

      try {
        setPermissionError(null);
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video:
            mode === "video"
              ? {
                  facingMode: "user",
                  frameRate: 24,
                  height: 720,
                  width: 1280,
                }
              : false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsMicMuted(false);
        setIsCameraEnabled(mode === "video");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Microphone or camera access was denied.";
        setPermissionError(message);
      }
    };

    void startMedia();

    return () => {
      active = false;
      stopAllMedia();
    };
  }, [mode, stopAllMedia]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    return () => {
      cleanupPeerSession();
    };
  }, [cleanupPeerSession]);

  return useMemo(
    () => ({
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
      stopAllMedia,
      toggleCamera,
      toggleMic,
    }),
    [
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
      stopAllMedia,
      toggleCamera,
      toggleMic,
    ],
  );
}
