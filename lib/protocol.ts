import type {
  ChatMode,
  MatchPartnerMeta,
  ReportReason,
  SignalKind,
} from "@/lib/domain";

export const SIGNALING_EVENT = {
  BANNED: "banned",
  CHAT_MESSAGE: "chat_message",
  ERROR: "error",
  FORCE_DISCONNECT: "force_disconnect",
  HELLO: "hello",
  ICE_FAILED: "ice_failed",
  JOIN_QUEUE: "join_queue",
  LEAVE: "leave",
  MATCHED: "matched",
  QUEUE_STATE: "queue_state",
  REQUEUED: "requeued",
  REPORT_ACK: "report_ack",
  REPORT_USER: "report_user",
  SIGNAL: "signal",
  SKIP: "skip",
  STATUS: "status",
  STRANGER_DISCONNECTED: "stranger_disconnected",
  TYPING_STATE: "typing_state",
  WARNING: "warning",
} as const;

export interface MatchFilterRequest {
  countryFilters: string[];
  genderFilters: string[];
  interestFilters: string[];
}

export interface HelloPayload {
  clientId: string;
}

export interface JoinQueuePayload {
  accessToken: string;
  filters: MatchFilterRequest;
  mode: ChatMode;
}

export interface QueueStatePayload {
  mode: ChatMode;
  queueDepth: number;
  status: "matched" | "queued" | "searching";
}

export interface StatusPayload {
  kind: "error" | "info" | "success";
  message: string;
}

export interface MatchedPayload {
  adEligible: boolean;
  initiator: boolean;
  matchedAt: string;
  partner: MatchPartnerMeta;
  roomId: string;
}

export interface SkipPayload {
  reason?: "manual" | "moderation";
}

export interface LeavePayload {
  reason?: "manual";
}

export interface IceFailedPayload {
  roomId: string;
}

export interface IceCandidateData {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
  usernameFragment?: string | null;
}

export interface SessionDescriptionData {
  sdp?: string;
  type: "answer" | "offer" | "pranswer" | "rollback";
}

export interface SignalPayload {
  candidate?: IceCandidateData;
  description?: SessionDescriptionData;
  kind: SignalKind;
  roomId: string;
}

export interface ChatMessagePayload {
  text: string;
  timestamp: string;
}

export interface TypingStatePayload {
  isTyping: boolean;
}

export interface ReportUserPayload {
  reason: ReportReason;
  source: "manual" | "moderation";
}

export interface ReportAckPayload {
  reason: ReportReason;
  targetReportCount: number;
}

export interface RequeuedPayload {
  reason: "disconnect" | "ice_failure" | "skip";
}

export interface StrangerDisconnectedPayload {
  reason: "disconnect" | "leave";
}

export interface ForceDisconnectPayload {
  reason: "too_many_reports";
}

export interface WarningPayload {
  reportCount: number;
}

export interface BannedPayload {
  reportCount: number;
}

export interface ClientPayloadMap {
  [SIGNALING_EVENT.CHAT_MESSAGE]: ChatMessagePayload;
  [SIGNALING_EVENT.ICE_FAILED]: IceFailedPayload;
  [SIGNALING_EVENT.JOIN_QUEUE]: JoinQueuePayload;
  [SIGNALING_EVENT.LEAVE]: LeavePayload;
  [SIGNALING_EVENT.REPORT_USER]: ReportUserPayload;
  [SIGNALING_EVENT.SIGNAL]: SignalPayload;
  [SIGNALING_EVENT.SKIP]: SkipPayload;
  [SIGNALING_EVENT.TYPING_STATE]: TypingStatePayload;
}

export interface ServerPayloadMap {
  [SIGNALING_EVENT.BANNED]: BannedPayload;
  [SIGNALING_EVENT.CHAT_MESSAGE]: ChatMessagePayload;
  [SIGNALING_EVENT.ERROR]: StatusPayload;
  [SIGNALING_EVENT.FORCE_DISCONNECT]: ForceDisconnectPayload;
  [SIGNALING_EVENT.HELLO]: HelloPayload;
  [SIGNALING_EVENT.MATCHED]: MatchedPayload;
  [SIGNALING_EVENT.QUEUE_STATE]: QueueStatePayload;
  [SIGNALING_EVENT.REQUEUED]: RequeuedPayload;
  [SIGNALING_EVENT.REPORT_ACK]: ReportAckPayload;
  [SIGNALING_EVENT.SIGNAL]: SignalPayload;
  [SIGNALING_EVENT.STATUS]: StatusPayload;
  [SIGNALING_EVENT.STRANGER_DISCONNECTED]: StrangerDisconnectedPayload;
  [SIGNALING_EVENT.TYPING_STATE]: TypingStatePayload;
  [SIGNALING_EVENT.WARNING]: WarningPayload;
}

export interface Envelope<TType extends string, TPayload> {
  payload: TPayload;
  type: TType;
}

export type ClientEnvelope = {
  [TType in keyof ClientPayloadMap]: Envelope<TType, ClientPayloadMap[TType]>;
}[keyof ClientPayloadMap];

export type ServerEnvelope = {
  [TType in keyof ServerPayloadMap]: Envelope<TType, ServerPayloadMap[TType]>;
}[keyof ServerPayloadMap];
