import { DurableObject } from "cloudflare:workers";

import type { ChatMode, Gender } from "../lib/domain";
import { getFreeTierCountryPool } from "../lib/matching";
import {
  type ChatMessagePayload,
  type ClientEnvelope,
  type JoinQueuePayload,
  type MatchedPayload,
  type MatchFilterRequest,
  type QueueStatePayload,
  type ReportAckPayload,
  type ReportUserPayload,
  SIGNALING_EVENT,
  type SignalPayload,
  type StatusPayload,
  type StrangerDisconnectedPayload,
  type TypingStatePayload,
  type WarningPayload,
} from "../lib/protocol";

import type { Env } from "./index";
import {
  type JoinContext,
  type MatchPreferencesRow,
  type ProfileRow,
  type SubscriptionRow,
  hydrateJoinContext,
  submitUserReport,
} from "./supabase";

type ClientStatus = "matched" | "queued" | "ready";

interface ClientAttachment {
  accessToken: string | null;
  clientId: string;
  filters: MatchFilterRequest;
  joinCount: number;
  mode: ChatMode;
  peerId: string | null;
  preferences: MatchPreferencesRow | null;
  profile: ProfileRow | null;
  roomId: string | null;
  status: ClientStatus;
  subscription: SubscriptionRow | null;
  userId: string | null;
}

interface ClientRecord {
  attachment: ClientAttachment;
  socket: WebSocket;
}

interface RoomRecord {
  clientIds: [string, string];
  createdAt: number;
  id: string;
  mode: ChatMode;
}

function defaultFilters(): MatchFilterRequest {
  return {
    countryFilters: [],
    genderFilters: [],
    interestFilters: [],
  };
}

function intersectInterests(first: string[], second: string[]): string[] {
  const secondLookup = new Set(second.map((item) => item.toLowerCase()));
  return first
    .filter((item) => secondLookup.has(item.toLowerCase()))
    .slice(0, 3);
}

export class Matchmaker extends DurableObject<Env> {
  private clients = new Map<string, ClientRecord>();

  private queues: Record<ChatMode, string[]> = {
    text: [],
    video: [],
    voice: [],
  };

  private rooms = new Map<string, RoomRecord>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.restoreState();
  }

  public async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected websocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [clientSocket, serverSocket] = Object.values(pair);
    const clientId = crypto.randomUUID();
    const attachment: ClientAttachment = {
      accessToken: null,
      clientId,
      filters: defaultFilters(),
      joinCount: 0,
      mode: "video",
      peerId: null,
      preferences: null,
      profile: null,
      roomId: null,
      status: "ready",
      subscription: null,
      userId: null,
    };

    this.ctx.acceptWebSocket(serverSocket, [`client:${clientId}`]);
    serverSocket.serializeAttachment(attachment);
    this.clients.set(clientId, {
      attachment,
      socket: serverSocket,
    });

    this.send(serverSocket, SIGNALING_EVENT.HELLO, { clientId });
    this.sendStatus(serverSocket, "info", "Socket connected.");

    return new Response(null, {
      status: 101,
      webSocket: clientSocket,
    });
  }

  public webSocketClose(
    socket: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): void {
    const attachment = this.readAttachment(socket);
    if (!attachment) {
      return;
    }
    this.handleDeparture(attachment.clientId, "disconnect");
  }

  public webSocketMessage(
    socket: WebSocket,
    message: string | ArrayBuffer,
  ): void {
    if (typeof message !== "string") {
      return;
    }

    const envelope = JSON.parse(message) as ClientEnvelope;
    const attachment = this.readAttachment(socket);
    if (!attachment) {
      return;
    }

    switch (envelope.type) {
      case SIGNALING_EVENT.JOIN_QUEUE:
        void this.handleJoinQueue(attachment.clientId, envelope.payload).catch(
          (error) => {
            this.sendStatus(
              socket,
              "error",
              error instanceof Error ? error.message : "Join failed.",
            );
          },
        );
        break;
      case SIGNALING_EVENT.SIGNAL:
        this.forwardSignal(attachment.clientId, envelope.payload);
        break;
      case SIGNALING_EVENT.CHAT_MESSAGE:
        this.forwardChat(attachment.clientId, envelope.payload);
        break;
      case SIGNALING_EVENT.TYPING_STATE:
        this.forwardTyping(attachment.clientId, envelope.payload);
        break;
      case SIGNALING_EVENT.SKIP:
        this.requeueRoom(attachment.clientId, "skip");
        break;
      case SIGNALING_EVENT.LEAVE:
        this.handleDeparture(attachment.clientId, "leave");
        break;
      case SIGNALING_EVENT.ICE_FAILED:
        this.requeueRoom(attachment.clientId, "ice_failure");
        break;
      case SIGNALING_EVENT.REPORT_USER:
        void this.registerReport(attachment.clientId, envelope.payload).catch(
          (error) => {
            this.sendStatus(
              socket,
              "error",
              error instanceof Error ? error.message : "Report failed.",
            );
          },
        );
        break;
      default:
        this.sendStatus(socket, "error", "Unsupported event.");
    }
  }

  private addToQueue(clientId: string, mode: ChatMode): void {
    const queue = this.queues[mode];
    if (!queue.includes(clientId)) {
      queue.push(clientId);
    }
  }

  private canUsersMatch(first: ClientAttachment, second: ClientAttachment): boolean {
    return this.matchesForViewer(first, second) && this.matchesForViewer(second, first);
  }

  private enqueueClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client || !client.attachment.profile) {
      return;
    }

    this.removeFromAllQueues(clientId);
    client.attachment.peerId = null;
    client.attachment.roomId = null;
    client.attachment.status = "queued";
    this.persist(client);
    this.addToQueue(clientId, client.attachment.mode);
    this.send(client.socket, SIGNALING_EVENT.QUEUE_STATE, {
      mode: client.attachment.mode,
      queueDepth: this.queues[client.attachment.mode].length,
      status: "queued",
    } satisfies QueueStatePayload);
    this.sendStatus(client.socket, "info", "Looking for someone...");

    this.tryMatch(client.attachment.mode);
  }

  private forwardChat(clientId: string, payload: ChatMessagePayload): void {
    this.forwardToPeer(clientId, SIGNALING_EVENT.CHAT_MESSAGE, payload);
  }

  private forwardSignal(clientId: string, payload: SignalPayload): void {
    this.forwardToPeer(clientId, SIGNALING_EVENT.SIGNAL, payload);
  }

  private forwardTyping(clientId: string, payload: TypingStatePayload): void {
    this.forwardToPeer(clientId, SIGNALING_EVENT.TYPING_STATE, payload);
  }

  private forwardToPeer<TPayload>(
    clientId: string,
    type:
      | typeof SIGNALING_EVENT.CHAT_MESSAGE
      | typeof SIGNALING_EVENT.SIGNAL
      | typeof SIGNALING_EVENT.TYPING_STATE,
    payload: TPayload,
  ): void {
    const client = this.clients.get(clientId);
    const peerId = client?.attachment.peerId;
    if (!peerId) {
      return;
    }

    const peer = this.clients.get(peerId);
    if (!peer) {
      return;
    }

    this.send(peer.socket, type, payload);
  }

  private async handleJoinQueue(
    clientId: string,
    payload: JoinQueuePayload,
  ): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    const context = await hydrateJoinContext(payload.accessToken, this.env);
    if (!context.profile.onboarding_completed_at) {
      throw new Error("Onboarding must be completed before joining matchmaking.");
    }

    client.attachment.accessToken = payload.accessToken;
    client.attachment.filters = payload.filters;
    client.attachment.joinCount = context.joinCount;
    client.attachment.mode = payload.mode;
    client.attachment.preferences = context.preferences;
    client.attachment.profile = context.profile;
    client.attachment.subscription = context.subscription;
    client.attachment.userId = context.userId;
    this.persist(client);

    if (context.profile.banned_at) {
      this.send(client.socket, SIGNALING_EVENT.BANNED, {
        reportCount: context.profile.report_count,
      });
      this.sendStatus(client.socket, "error", "Your account is banned.");
      return;
    }

    this.enqueueClient(clientId);
  }

  private handleDeparture(
    clientId: string,
    reason: "disconnect" | "leave",
  ): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    this.removeFromAllQueues(clientId);
    const peerId = client.attachment.peerId;
    const roomId = client.attachment.roomId;
    this.clients.delete(clientId);

    if (roomId) {
      this.rooms.delete(roomId);
    }

    if (peerId) {
      const peer = this.clients.get(peerId);
      if (peer) {
        peer.attachment.peerId = null;
        peer.attachment.roomId = null;
        peer.attachment.status = "queued";
        this.persist(peer);
        this.send(peer.socket, SIGNALING_EVENT.STRANGER_DISCONNECTED, {
          reason,
        } satisfies StrangerDisconnectedPayload);
        this.enqueueClient(peerId);
      }
    }
  }

  private matchesForViewer(
    viewer: ClientAttachment,
    candidate: ClientAttachment,
  ): boolean {
    if (!viewer.profile || !candidate.profile) {
      return false;
    }

    if (viewer.subscription?.is_active) {
      return this.matchesPremiumFilters(viewer.filters, candidate.profile);
    }

    const localPool = getFreeTierCountryPool(viewer.profile.country_code);
    const allowForeign = viewer.joinCount % 10 === 0;
    if (!allowForeign && !localPool.includes(candidate.profile.country_code)) {
      return false;
    }

    if (viewer.profile.gender === "male" || viewer.profile.gender === "female") {
      const allowCrossGender = viewer.joinCount % 11 === 0;
      if (!allowCrossGender && candidate.profile.gender !== viewer.profile.gender) {
        return false;
      }
    }

    return true;
  }

  private matchesPremiumFilters(
    filters: MatchFilterRequest,
    candidate: ProfileRow,
  ): boolean {
    if (
      filters.countryFilters.length > 0 &&
      !filters.countryFilters.includes(candidate.country_code)
    ) {
      return false;
    }

    if (
      filters.genderFilters.length > 0 &&
      !filters.genderFilters.includes(candidate.gender)
    ) {
      return false;
    }

    if (
      filters.interestFilters.length > 0 &&
      !candidate.interests.some((interest) =>
        filters.interestFilters
          .map((item) => item.toLowerCase())
          .includes(interest.toLowerCase()),
      )
    ) {
      return false;
    }

    return true;
  }

  private persist(client: ClientRecord): void {
    client.socket.serializeAttachment(client.attachment);
  }

  private readAttachment(socket: WebSocket): ClientAttachment | null {
    return (socket.deserializeAttachment() as ClientAttachment | null) ?? null;
  }

  private async registerReport(
    reporterClientId: string,
    payload: ReportUserPayload,
  ): Promise<void> {
    const reporter = this.clients.get(reporterClientId);
    if (!reporter?.attachment.peerId || !reporter.attachment.accessToken) {
      return;
    }

    const target = this.clients.get(reporter.attachment.peerId);
    if (!target?.attachment.userId) {
      return;
    }

    const roomId = reporter.attachment.roomId;
    if (!roomId) {
      return;
    }

    const result = await submitUserReport(reporter.attachment.accessToken, this.env, {
      matchId: roomId,
      mode: reporter.attachment.mode,
      reason: payload.reason,
      targetUserId: target.attachment.userId,
    });

    if (target.attachment.profile) {
      target.attachment.profile.report_count = result.reportCount;
      this.persist(target);
    }

    this.send(reporter.socket, SIGNALING_EVENT.REPORT_ACK, {
      reason: payload.reason,
      targetReportCount: result.reportCount,
    } satisfies ReportAckPayload);

    if (result.warned) {
      this.send(target.socket, SIGNALING_EVENT.WARNING, {
        reportCount: result.reportCount,
      } satisfies WarningPayload);
    }

    if (result.banned) {
      this.send(target.socket, SIGNALING_EVENT.BANNED, {
        reportCount: result.reportCount,
      });
      this.send(target.socket, SIGNALING_EVENT.FORCE_DISCONNECT, {
        reason: "too_many_reports",
      });
      target.socket.close(4008, "too_many_reports");
      this.handleDeparture(target.attachment.clientId, "leave");
    }
  }

  private removeFromAllQueues(clientId: string): void {
    (Object.keys(this.queues) as ChatMode[]).forEach((mode) => {
      this.queues[mode] = this.queues[mode].filter((id) => id !== clientId);
    });
  }

  private requeueRoom(clientId: string, reason: "ice_failure" | "skip"): void {
    const client = this.clients.get(clientId);
    const roomId = client?.attachment.roomId;
    if (!client || !roomId) {
      if (client) {
        this.enqueueClient(clientId);
      }
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.enqueueClient(clientId);
      return;
    }

    this.rooms.delete(roomId);
    room.clientIds.forEach((participantId) => {
      const participant = this.clients.get(participantId);
      if (!participant) {
        return;
      }
      participant.attachment.peerId = null;
      participant.attachment.roomId = null;
      participant.attachment.status = "queued";
      this.persist(participant);
      this.send(participant.socket, SIGNALING_EVENT.REQUEUED, { reason });
      this.enqueueClient(participantId);
    });
  }

  private restoreState(): void {
    const sockets = this.ctx.getWebSockets();
    const roomDrafts = new Map<string, RoomRecord>();

    sockets.forEach((socket) => {
      const attachment = this.readAttachment(socket);
      if (!attachment) {
        return;
      }

      this.clients.set(attachment.clientId, {
        attachment,
        socket,
      });

      if (attachment.status === "queued") {
        this.addToQueue(attachment.clientId, attachment.mode);
      }

      if (attachment.roomId && attachment.peerId) {
        roomDrafts.set(attachment.roomId, {
          clientIds: [attachment.clientId, attachment.peerId],
          createdAt: Date.now(),
          id: attachment.roomId,
          mode: attachment.mode,
        });
      }
    });

    roomDrafts.forEach((room, roomId) => {
      this.rooms.set(roomId, room);
    });
  }

  private send<TPayload>(
    socket: WebSocket,
    type: string,
    payload: TPayload,
  ): void {
    socket.send(
      JSON.stringify({
        payload,
        type,
      }),
    );
  }

  private sendStatus(
    socket: WebSocket,
    kind: StatusPayload["kind"],
    message: string,
  ): void {
    this.send(socket, SIGNALING_EVENT.STATUS, {
      kind,
      message,
    } satisfies StatusPayload);
  }

  private tryMatch(mode: ChatMode): void {
    const queue = this.queues[mode];

    for (let firstIndex = 0; firstIndex < queue.length; firstIndex += 1) {
      const firstId = queue[firstIndex];
      const firstClient = this.clients.get(firstId);
      if (!firstClient || firstClient.attachment.status !== "queued") {
        continue;
      }

      for (
        let secondIndex = firstIndex + 1;
        secondIndex < queue.length;
        secondIndex += 1
      ) {
        const secondId = queue[secondIndex];
        const secondClient = this.clients.get(secondId);
        if (!secondClient || secondClient.attachment.status !== "queued") {
          continue;
        }

        if (!this.canUsersMatch(firstClient.attachment, secondClient.attachment)) {
          continue;
        }

        this.queues[mode] = queue.filter(
          (id) => id !== firstId && id !== secondId,
        );

        const roomId = crypto.randomUUID();
        const createdAt = Date.now();
        this.rooms.set(roomId, {
          clientIds: [firstId, secondId],
          createdAt,
          id: roomId,
          mode,
        });

        firstClient.attachment.peerId = secondId;
        firstClient.attachment.roomId = roomId;
        firstClient.attachment.status = "matched";
        this.persist(firstClient);

        secondClient.attachment.peerId = firstId;
        secondClient.attachment.roomId = roomId;
        secondClient.attachment.status = "matched";
        this.persist(secondClient);

        const firstPartner = secondClient.attachment.profile;
        const secondPartner = firstClient.attachment.profile;

        if (!firstPartner || !secondPartner) {
          return;
        }

        this.send(firstClient.socket, SIGNALING_EVENT.MATCHED, {
          adEligible:
            !firstClient.attachment.subscription?.is_active &&
            firstClient.attachment.joinCount % 5 === 0,
          initiator: true,
          matchedAt: new Date(createdAt).toISOString(),
          partner: {
            country_code: firstPartner.country_code,
            gender: firstPartner.gender as Gender,
            interests: intersectInterests(
              firstClient.attachment.profile?.interests ?? [],
              firstPartner.interests,
            ),
          },
          roomId,
        } satisfies MatchedPayload);

        this.send(secondClient.socket, SIGNALING_EVENT.MATCHED, {
          adEligible:
            !secondClient.attachment.subscription?.is_active &&
            secondClient.attachment.joinCount % 5 === 0,
          initiator: false,
          matchedAt: new Date(createdAt).toISOString(),
          partner: {
            country_code: secondPartner.country_code,
            gender: secondPartner.gender as Gender,
            interests: intersectInterests(
              secondClient.attachment.profile?.interests ?? [],
              secondPartner.interests,
            ),
          },
          roomId,
        } satisfies MatchedPayload);

        this.tryMatch(mode);
        return;
      }
    }
  }
}
