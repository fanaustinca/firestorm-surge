// Mode-only matchmaking room + map vote.
// Players pick just a game mode; they are dropped into a room (P2P lobby, or offline with bots),
// then everyone votes on one of 4 candidate maps. The host (lowest human id) owns the vote state,
// fills empty slots with bots (who vote too) and starts the match on the winning map.
import { MAPS } from '../world/maps.js';
import { MODES } from '../game/match.js';
import { botName } from '../game/bots.js';

const VOTE_SECS = 15;

export class Lobby {
  constructor(game, modeId, { online = true, voteSecs } = {}) {
    this.g = game; this.net = game.net; this.modeId = modeId; this.mode = MODES[modeId]; this.online = online;
    this.voteSecs = voteSecs ?? window.__voteSecs ?? (game.testMode ? 4 : VOTE_SECS);
    this.state = null; this.status = online ? 'Searching for a room…' : 'Offline room — bots fill every slot';
    this.played = new Set(); this.listeners = new Set(); this.closed = false; this.lastSend = 0; this.botVoteAt = new Map();
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this); }
  get selfId() { return this.net.selfId; }
  get isHost() { return !this.net.connected || this.net.isHost; }
  get humans() { return this.net.connected ? this.net.peerList : [{ id: this.selfId, name: this.g.playerName }]; }
  get bots() { const n = Math.max(0, this.mode.size - this.humans.length); return Array.from({ length: n }, (_, k) => ({ id: 'bot-' + (this.humans.length + k), name: botName(this.humans.length + k) })); }
  get timeLeft() { return this.state ? Math.max(0, (this.state.endsAt - performance.now()) / 1000) : this.voteSecs; }

  async start() {
    if (this.online) {
      if (this.net.connected && this.net.lobby?.includes(`-${this.modeId}-`)) this.status = `Room ${this.net.lobby}`;
      else {
        if (this.net.connected) await this.net.leave();
        const ok = await this.net.connect(this.modeId, this.mode.size, (msg) => { this.status = msg; this.emit(); });
        if (this.closed) return;
        this.status = ok ? `Room ${this.net.lobby}` : 'No P2P relay reachable — offline room with bots';
      }
      this.net.onLobby = (d) => this.applyRemote(d);
      this.net.onVote = (d) => { if (this.isHost && this.state?.phase === 'vote' && this.state.cands.includes(d.map)) { this.state.votes[d.id] = d.map; this.broadcast(true); this.emit(); } };
      this.net.onPeers = () => { if (this.isHost && !this.state) this.newVote(); this.broadcast(true); this.emit(); };
    }
    // wait briefly for an existing host's state before opening our own vote
    setTimeout(() => { if (!this.closed && !this.state && this.isHost) this.newVote(); }, this.net.connected ? 1500 : 0);
    this.timer = setInterval(() => this.tick(), 200);
    this.emit();
  }

  newVote() {
    const ids = Object.keys(MAPS); const cands = [];
    while (cands.length < 4) { const m = ids[(Math.random() * ids.length) | 0]; if (!cands.includes(m)) cands.push(m); }
    this.state = { phase: 'vote', cands, votes: {}, endsAt: performance.now() + this.voteSecs * 1000, map: null, seq: (this.state?.seq || 0) + 1 };
    this.botVoteAt.clear();
    for (const b of this.bots) this.botVoteAt.set(b.id, 0.6 + Math.random() * (this.voteSecs * 0.75));
    this.broadcast(true); this.emit();
  }
  vote(map) {
    if (!this.state || this.state.phase !== 'vote' || !this.state.cands.includes(map)) return;
    this.state.votes[this.selfId] = map;
    if (this.isHost) this.broadcast(true); else this.net.sendVote({ id: this.selfId, map });
    this.emit();
  }
  tally() {
    const c = {}; for (const m of this.state.cands) c[m] = 0;
    for (const v of Object.values(this.state.votes)) if (c[v] != null) c[v]++;
    return c;
  }
  tick() {
    if (this.closed || !this.state) return;
    if (this.isHost && this.state.phase === 'vote') {
      const elapsed = this.voteSecs - this.timeLeft;
      for (const [id, at] of this.botVoteAt) if (elapsed >= at && !this.state.votes[id]) { this.state.votes[id] = this.state.cands[(Math.random() * 4) | 0]; this.broadcast(true); }
      if (this.timeLeft <= 0) {
        const c = this.tally(); const top = Math.max(...Object.values(c)); const best = this.state.cands.filter((m) => c[m] === top);
        this.state.phase = 'match'; this.state.map = best[(Math.random() * best.length) | 0];
        this.broadcast(true);
      }
    }
    if (this.isHost) this.broadcast(false);
    if (this.state.phase === 'match' && !this.played.has(this.state.seq) && this.active) { this.played.add(this.state.seq); this.onStartMatch?.(this.state.map); }
    this.emit();
  }
  broadcast(force) {
    if (!this.net.connected || !this.state || !this.isHost) return;
    const now = performance.now(); if (!force && now - this.lastSend < 1000) return; this.lastSend = now;
    const { phase, cands, votes, map, seq } = this.state;
    this.net.sendLobby({ phase, cands, votes, map, seq, left: this.timeLeft });
  }
  applyRemote(d) {
    if (this.isHost && this.state) return;
    this.state = { phase: d.phase, cands: d.cands, votes: d.votes || {}, map: d.map, seq: d.seq, endsAt: performance.now() + (d.left || 0) * 1000 };
    this.emit();
  }
  // host: open a fresh vote once its match is over
  matchEnded() { if (this.isHost && this.state?.phase === 'match') setTimeout(() => { if (!this.closed && this.state?.phase === 'match') this.newVote(); }, this.g.testMode ? 300 : 6000); }
  close() { this.closed = true; this.active = false; clearInterval(this.timer); this.listeners.clear(); }
}
