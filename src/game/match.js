// Game modes: Red vs Blue TDM, Free-For-All, 2v2 Wingman (Bo7 rounds), 1v1 Duel (Bo5 rounds).
export const MODES = {
  red_vs_blue: { id: 'red_vs_blue', name: 'Red vs. Blue', short: 'TDM', teams: true, size: 10, time: 300, killLimit: 50, respawn: 3, desc: '5v5 team deathmatch · 5 min · 50 kills' },
  ffa: { id: 'ffa', name: 'Free-For-All', short: 'FFA', teams: false, size: 8, time: 240, killLimit: 25, respawn: 2.5, desc: '8 players · 4 min · 25 kills' },
  '2v2': { id: '2v2', name: '2v2 Wingman', short: '2v2', teams: true, size: 4, roundTime: 60, winRounds: 4, maxRounds: 7, desc: 'Best of 7 rounds · 60 s · no respawns' },
  '1v1': { id: '1v1', name: '1v1 Duel', short: '1v1', teams: true, size: 2, roundTime: 45, winRounds: 3, maxRounds: 5, desc: 'Best of 5 rounds · 45 s · no respawns' },
};

export class Match {
  constructor(game, modeId) {
    this.g = game; this.mode = MODES[modeId]; this.id = modeId;
    this.phase = 'warmup'; this.t = 3; this.timeLeft = this.mode.time || this.mode.roundTime;
    this.score = { red: 0, blue: 0 }; this.rounds = { red: 0, blue: 0 }; this.round = 1; this.winner = null; this.ended = false;
  }
  get roundBased() { return !!this.mode.winRounds; }

  teamFor(index) { return this.mode.teams ? (index % 2 === 0 ? 'red' : 'blue') : 'ffa'; }

  spawnFor(actor) {
    const sp = this.g.map.spawns; const list = this.mode.teams ? sp[actor.team] : sp.ffa;
    const others = this.g.actors.filter((a) => a !== actor && a.alive);
    let best = list[0], bs = -Infinity;
    for (const p of list) {
      let minE = Infinity, nearMate = 0;
      for (const o of others) { const d = o.pos.distanceTo(p); if (this.g.hostile(actor, o)) minE = Math.min(minE, d); else if (d < 1.2) nearMate++; }
      const s = Math.min(minE, 60) - nearMate * 20 + Math.random() * 6;
      if (s > bs) { bs = s; best = p; }
    }
    return best.clone();
  }
  faceCenter(p) { return Math.atan2(p.x, p.z); }

  update(dt) {
    if (this.ended) return;
    if (this.phase === 'warmup' || this.phase === 'roundEnd') {
      this.t -= dt;
      if (this.t <= 0) {
        if (this.phase === 'roundEnd') this.startRound(); else { this.phase = 'live'; this.g.onPhase?.('live'); }
      }
      return;
    }
    if (this.phase !== 'live') return;
    this.timeLeft -= dt;
    if (!this.roundBased) {
      for (const a of this.g.actors) if (!a.alive && a.respawnT > 0) { a.respawnT -= dt; if (a.respawnT <= 0 && this.g.owns(a)) this.g.respawnActor(a); }
      if (this.timeLeft <= 0) this.end();
    } else {
      const alive = { red: 0, blue: 0 };
      for (const a of this.g.actors) if (a.alive) alive[a.team]++;
      if (alive.red === 0 || alive.blue === 0) this.endRound(alive.red > 0 ? 'red' : alive.blue > 0 ? 'blue' : null);
      else if (this.timeLeft <= 0) {
        const hp = { red: 0, blue: 0 }; for (const a of this.g.actors) if (a.alive) hp[a.team] += a.hp + a.armor;
        this.endRound(alive.red !== alive.blue ? (alive.red > alive.blue ? 'red' : 'blue') : hp.red === hp.blue ? null : hp.red > hp.blue ? 'red' : 'blue');
      }
    }
  }

  onKill(victim, killer) {
    if (this.phase !== 'live') return;
    if (!this.roundBased) {
      victim.respawnT = this.mode.respawn;
      if (killer && killer !== victim) {
        if (this.mode.teams) { this.score[killer.team]++; if (this.score[killer.team] >= this.mode.killLimit) this.end(); }
        else if (killer.stats.kills >= this.mode.killLimit) this.end();
      } else if (this.mode.teams) this.score[victim.team] = Math.max(0, this.score[victim.team] - 1);
    }
  }

  endRound(winner) {
    this.phase = 'roundEnd'; this.t = 3.5;
    if (winner) this.rounds[winner]++;
    this.lastRoundWinner = winner;
    this.g.onRoundEnd?.(winner);
    if (this.rounds.red >= this.mode.winRounds || this.rounds.blue >= this.mode.winRounds || this.round >= this.mode.maxRounds) { this.t = 0; this.end(); }
  }
  startRound() {
    this.round++; this.phase = 'live'; this.timeLeft = this.mode.roundTime;
    for (const a of this.g.actors) if (this.g.owns(a)) this.g.respawnActor(a);
    this.g.combat.reset(); this.g.effects.clear();
    this.g.onPhase?.('round');
  }

  end() {
    if (this.ended) return; this.ended = true; this.phase = 'end';
    let w = null;
    if (this.roundBased) w = this.rounds.red === this.rounds.blue ? null : this.rounds.red > this.rounds.blue ? 'red' : 'blue';
    else if (this.mode.teams) w = this.score.red === this.score.blue ? null : this.score.red > this.score.blue ? 'red' : 'blue';
    else { const top = [...this.g.actors].sort((a, b) => b.stats.kills - a.stats.kills)[0]; w = top ? top.id : null; }
    this.winner = w;
    this.g.onMatchEnd?.(w);
  }

  // human-readable score line
  scoreline() {
    if (this.roundBased) return { left: this.rounds.red, right: this.rounds.blue, label: `ROUND ${this.round}` };
    if (this.mode.teams) return { left: this.score.red, right: this.score.blue, label: `FIRST TO ${this.mode.killLimit}` };
    const sorted = [...this.g.actors].sort((a, b) => b.stats.kills - a.stats.kills);
    return { left: this.g.player?.stats.kills ?? 0, right: sorted[0]?.stats.kills ?? 0, label: `FIRST TO ${this.mode.killLimit}`, ffa: true, leader: sorted[0]?.name };
  }
  serialize() { return { phase: this.phase, t: this.t, timeLeft: this.timeLeft, score: this.score, rounds: this.rounds, round: this.round, ended: this.ended }; }
  apply(s) { Object.assign(this, { phase: s.phase, t: s.t, timeLeft: s.timeLeft, score: s.score, rounds: s.rounds, round: s.round }); if (s.ended && !this.ended) this.end(); }
}
