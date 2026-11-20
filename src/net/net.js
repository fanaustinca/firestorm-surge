// Zero-server WebRTC multiplayer via Trystero (Nostr signalling).
// Auto-matchmaking into numbered lobbies `firestorm-${mode}-lobby-${n}`; 20 Hz state sync.
// Authority: each peer simulates its own player + the bots it owns (botIndex % humans.length).
const APP_ID = 'firestorm-surge.v1';
const SEND_HZ = 20;

export class Net {
  constructor(game) {
    this.g = game; this.room = null; this.connected = false; this.peers = new Map(); // peerId → {id, name, lastSeen}
    this.selfId = 'h-' + Math.random().toString(36).slice(2, 10); this.lobby = null; this.sendAcc = 0; this.status = 'offline';
  }
  get humans() { return [this.selfId, ...[...this.peers.values()].map((p) => p.id)].sort(); }
  get isHost() { return this.humans[0] === this.selfId; }
  // humans actually playing THIS match (recent state packets with our match id) — bot ownership is split among these only
  get players() { const now = performance.now(); return [this.selfId, ...[...this.peers.values()].filter((p) => p.mid === this.matchId && now - (p.midSeen || 0) < 2500).map((p) => p.id)].sort(); }

  async connect(modeId, maxHumans, onStatus = () => {}) {
    let joinRoom;
    try { ({ joinRoom } = await import('trystero')); } catch (e) { this.status = 'offline'; onStatus('Multiplayer unavailable — playing with bots'); return false; }
    for (let n = 1; n <= 12; n++) {
      const name = `firestorm-${modeId}-lobby-${n}`;
      onStatus(`Searching ${name}…`);
      let room;
      try { room = joinRoom({ appId: APP_ID, identity: 'none' }, name); } catch { try { room = joinRoom({ appId: APP_ID }, name); } catch { return false; } }
      const peers = new Map();
      const hello = room.makeAction('hello');
      hello.onMessage((d, ctx) => { if (d && d.id && d.id !== this.selfId) peers.set(ctx.peerId, { id: d.id, name: d.name, playing: d.playing, lastSeen: performance.now() }); });
      room.onPeerJoin?.((ctx) => { hello.send({ id: this.selfId, name: this.g.playerName, playing: true }, { target: ctx.peerId }).catch(() => {}); });
      hello.send({ id: this.selfId, name: this.g.playerName, playing: true }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2200));
      if (peers.size + 1 <= maxHumans) { this.attach(room, hello, peers, name); onStatus(peers.size ? `Joined ${name} with ${peers.size} player(s)` : `Hosting ${name} — bots fill empty slots`); return true; }
      try { await room.leave(); } catch { /* ignore */ }
    }
    onStatus('All lobbies full — offline match');
    return false;
  }

  attach(room, hello, peers, name) {
    this.room = room; this.lobby = name; this.connected = true; this.status = 'online'; this.peers = peers;
    this.stA = room.makeAction('st'); this.evA = room.makeAction('ev'); this.mA = room.makeAction('match'); this.hello = hello;
    this.lobA = room.makeAction('lob'); this.voteA = room.makeAction('vote');
    this.lobA.onMessage((d, ctx) => { const from = this.peers.get(ctx.peerId)?.id; if (from && from === this.humans[0]) this.onLobby?.(d); });
    this.voteA.onMessage((d) => this.onVote?.(d));
    hello.onMessage((d, ctx) => {
      if (!d?.id || d.id === this.selfId) return;
      const isNew = ![...this.peers.values()].some((p) => p.id === d.id);
      this.peers.set(ctx.peerId, { id: d.id, name: d.name, lastSeen: performance.now() });
      if (isNew) { if (this.g.state === 'playing') this.g.onPeerJoin(d.id, d.name); this.onPeers?.(); hello.send({ id: this.selfId, name: this.g.playerName }, { target: ctx.peerId }).catch(() => {}); }
    });
    room.onPeerJoin?.((ctx) => hello.send({ id: this.selfId, name: this.g.playerName }, { target: ctx.peerId }).catch(() => {}));
    room.onPeerLeave?.((ctx) => { const p = this.peers.get(ctx.peerId); if (p) { this.peers.delete(ctx.peerId); if (this.g.state === 'playing') this.g.onPeerLeave(p.id); this.onPeers?.(); } });
    this.stA.onMessage((d, ctx) => {
      const p = this.peers.get(ctx.peerId); if (!d || !Array.isArray(d.l)) return;
      if (p) { p.mid = d.m; p.midSeen = performance.now(); }
      if (d.m === this.matchId && this.g.state === 'playing') this.g.onRemoteState(d.l);
    });
    this.evA.onMessage((d) => this.g.onRemoteEvent(d));
    this.mA.onMessage((d, ctx) => { const from = this.peers.get(ctx.peerId)?.id; if (d?.m === this.matchId && from && from === this.players[0] && this.players[0] !== this.selfId) this.g.onRemoteMatch(d.s); });
  }
  sendLobby(d) { if (this.connected) this.lobA.send(d).catch(() => {}); }
  sendVote(d) { if (this.connected) this.voteA.send(d).catch(() => {}); }
  get peerList() { return [{ id: this.selfId, name: this.g.playerName }, ...[...this.peers.values()].map((p) => ({ id: p.id, name: p.name }))]; }

  owns(actor) {
    if (!this.connected) return true;
    if (actor.isRemote) return false;
    if (actor.isBot) { const h = this.players; return h[(actor.botIndex || 0) % h.length] === this.selfId; }
    return actor.isLocal;
  }

  // 20 Hz state packets for owned actors
  update(dt) {
    if (!this.connected || this.g.state !== 'playing') return;
    this.sendAcc += dt;
    if (this.sendAcc < 1 / SEND_HZ) return;
    this.sendAcc = 0;
    const list = [];
    for (const a of this.g.actors) {
      if (!this.owns(a)) continue;
      list.push([a.id, +a.pos.x.toFixed(2), +a.pos.y.toFixed(2), +a.pos.z.toFixed(2), +a.yaw.toFixed(3), +a.pitch.toFixed(3), a.slot, a.loadout[a.slot] || '', Math.round(a.hp), Math.round(a.armor), a.alive ? 1 : 0, a.team, a.name, a.isBot ? 1 : 0, +(Math.hypot(a.vel.x, a.vel.z)).toFixed(1), a.ws?.swing ? 1 : 0, a.stats.kills, a.stats.deaths, a.slideT > 0 ? 1 : 0]);
    }
    this.stA.send({ m: this.matchId, l: list }).catch(() => {});
    this.matchAcc = (this.matchAcc || 0) + 1;
    if (this.players[0] === this.selfId && this.matchAcc % 10 === 0 && this.g.match) this.mA.send({ m: this.matchId, s: this.g.match.serialize() }).catch(() => {});
  }
  event(e) { if (this.connected) this.evA.send(e).catch(() => {}); }
  async leave() { const r = this.room; this.room = null; this.connected = false; this.peers = new Map(); this.status = 'offline'; this.onLobby = this.onVote = this.onPeers = null; if (r) { try { await r.leave(); } catch { /* ignore */ } } }
}
