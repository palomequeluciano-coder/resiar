export interface Env {
  ARENA_ROOM: DurableObjectNamespace<ArenaRoom>;
  ARENA_LIVE_SECRET: string;
}

type TicketPayload = {
  typ?: string;
  iss?: string;
  aud?: string;
  sub?: string;
  iat: number;
  exp: number;
  match_id: string;
  match_code?: string;
  user_id?: string;
  username?: string | null;
  role?: string;
  question_count?: number;
};

type ParticipantState = {
  user_id: string;
  username?: string;
  role?: string;
  status?: string;
  score?: number;
  correct_count?: number;
  wrong_count?: number;
  total_answered?: number;
  streak_best?: number;
  time_spent_sec?: number;
};

type Session = {
  id: string;
  userId: string;
  username: string;
  role: string;
  joinedAt: number;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    }
  });
}

function b64urlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function b64urlToText(value: string) {
  return new TextDecoder().decode(b64urlToBytes(value));
}

function b64url(bytes: Uint8Array) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmac(data: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return b64url(new Uint8Array(sig));
}

async function verifyTicket(ticket: string, secret: string, matchId: string): Promise<TicketPayload> {
  const parts = String(ticket || '').split('.');
  let payload: TicketPayload;
  let signedData: string;
  let sig: string;

  if (parts.length === 3) {
    const [headerB64, payloadB64, signature] = parts;
    if (!headerB64 || !payloadB64 || !signature) throw new Error('invalid_ticket');
    signedData = `${headerB64}.${payloadB64}`;
    sig = signature;
    payload = JSON.parse(b64urlToText(payloadB64)) as TicketPayload;
  } else if (parts.length === 2) {
    const [payloadB64, signature] = parts;
    if (!payloadB64 || !signature) throw new Error('invalid_ticket');
    signedData = payloadB64;
    sig = signature;
    payload = JSON.parse(b64urlToText(payloadB64)) as TicketPayload;
  } else {
    throw new Error('invalid_ticket');
  }

  const expected = await hmac(signedData, secret);
  if (expected !== sig) throw new Error('bad_signature');

  const userId = payload.user_id || payload.sub;
  const isLegacyArenaTicket = payload.typ === 'resiar-arena-live';
  const isJwtArenaTicket = payload.iss === 'resiar-supabase' && payload.aud === 'arena-live-room';
  if (!isLegacyArenaTicket && !isJwtArenaTicket) throw new Error('bad_ticket_type');
  if (payload.match_id !== matchId) throw new Error('wrong_match');
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) throw new Error('expired_ticket');
  if (!userId) throw new Error('missing_user');

  return { ...payload, user_id: userId };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return json({ ok: true });
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, service: 'resiar-arena-live', version: 'v40' });

    const match = url.pathname.match(/^\/arena\/ws\/([^/]+)$/);
    if (!match) return json({ ok: false, error: 'not_found' }, 404);
    if (request.headers.get('Upgrade') !== 'websocket') return json({ ok: false, error: 'expected_websocket' }, 426);

    const matchId = decodeURIComponent(match[1]);
    const ticket = url.searchParams.get('ticket') || '';
    let payload: TicketPayload;
    try {
      payload = await verifyTicket(ticket, env.ARENA_LIVE_SECRET, matchId);
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : 'invalid_ticket' }, 401);
    }

    const id = env.ARENA_ROOM.idFromName(matchId);
    const stub = env.ARENA_ROOM.get(id);
    const roomUrl = new URL(request.url);
    roomUrl.searchParams.set('payload', btoa(JSON.stringify(payload)));
    return stub.fetch(new Request(roomUrl.toString(), request));
  }
};

export class ArenaRoom {
  state: DurableObjectState;
  env: Env;
  sessions: Map<WebSocket, Session> = new Map();
  participants: Map<string, ParticipantState> = new Map();
  matchId: string | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return json({ ok: false, error: 'expected_websocket' }, 426);
    const url = new URL(request.url);
    const rawPayload = url.searchParams.get('payload') || '';
    const payload = JSON.parse(atob(rawPayload)) as TicketPayload;
    const userId = payload.user_id || payload.sub;
    if (!userId) return json({ ok: false, error: 'missing_user' }, 401);
    this.matchId = payload.match_id;

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      username: payload.username || 'usuario',
      role: payload.role || 'player',
      joinedAt: Date.now()
    };
    this.sessions.set(server, session);
    const existingParticipant = this.participants.get(session.userId);
    this.mergeParticipant(existingParticipant ? {
      user_id: session.userId,
      username: session.username,
      role: session.role,
      status: 'connected'
    } : {
      user_id: session.userId,
      username: session.username,
      role: session.role,
      status: 'connected',
      total_answered: 0,
      correct_count: 0,
      wrong_count: 0,
      score: 0,
      streak_best: 0
    });

    this.send(server, 'snapshot');
    this.broadcast({ type: 'presence', match_id: this.matchId, participants: this.snapshot(), user_id: session.userId }, server);

    server.addEventListener('message', (event) => this.onMessage(server, event.data));
    server.addEventListener('close', () => this.onClose(server));
    server.addEventListener('error', () => this.onClose(server));

    return new Response(null, { status: 101, webSocket: client });
  }

  mergeParticipant(participant: ParticipantState) {
    const existing = this.participants.get(participant.user_id) || {};
    const merged: ParticipantState = { ...existing, ...participant };
    const presenceOnly = ['connected', 'disconnected', 'accepted', 'ready'].includes(String(participant.status || ''));
    const numericKeys: Array<keyof ParticipantState> = ['score', 'correct_count', 'wrong_count', 'total_answered', 'streak_best', 'time_spent_sec'];
    for (const key of numericKeys) {
      const oldValue = Number((existing as Record<string, unknown>)[key] || 0);
      const newValue = Number((participant as Record<string, unknown>)[key] || 0);
      if ((participant as Record<string, unknown>)[key] == null || (presenceOnly && oldValue > 0 && newValue === 0) || (oldValue > 0 && newValue < oldValue)) {
        (merged as Record<string, unknown>)[key] = (existing as Record<string, unknown>)[key];
      }
    }
    if (presenceOnly && ['playing', 'completed', 'completed_local'].includes(String(existing.status || ''))) merged.status = existing.status;
    this.participants.set(participant.user_id, merged);
  }

  snapshot() {
    return Array.from(this.participants.values());
  }

  send(ws: WebSocket, type: string, extra: Record<string, unknown> = {}) {
    ws.send(JSON.stringify({ type, match_id: this.matchId, participants: this.snapshot(), ...extra }));
  }

  broadcast(message: Record<string, unknown>, except?: WebSocket) {
    const raw = JSON.stringify(message);
    for (const ws of this.sessions.keys()) {
      if (ws === except) continue;
      try { ws.send(raw); } catch (_) { this.sessions.delete(ws); }
    }
  }

  onMessage(ws: WebSocket, data: unknown) {
    const session = this.sessions.get(ws);
    if (!session) return;
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(String(data)); } catch (_) { return; }
    const type = String(msg.type || '');
    const participant = msg.participant && typeof msg.participant === 'object' ? msg.participant as ParticipantState : null;

    if (participant?.user_id === session.userId) {
      this.mergeParticipant({ ...participant, username: participant.username || session.username, role: participant.role || session.role });
    }

    if (type === 'answer_submitted' || type === 'progress' || type === 'completed' || type === 'hello') {
      const outgoingType = type === 'completed' ? 'opponent_completed' : 'opponent_progress';
      const payload = { type: outgoingType, match_id: this.matchId, participant: participant || this.participants.get(session.userId), participants: this.snapshot() };
      this.broadcast(payload, ws);
      this.send(ws, 'ack', { participant: this.participants.get(session.userId), participants: this.snapshot() });
    }
  }

  onClose(ws: WebSocket) {
    const session = this.sessions.get(ws);
    this.sessions.delete(ws);
    if (!session) return;
    const stillConnected = Array.from(this.sessions.values()).some((s) => s.userId === session.userId);
    if (!stillConnected) {
      const existing = this.participants.get(session.userId);
      if (existing && existing.status !== 'completed') this.mergeParticipant({ ...existing, status: 'disconnected' });
      this.broadcast({ type: 'presence', match_id: this.matchId, participants: this.snapshot(), user_id: session.userId });
    }
  }
}
