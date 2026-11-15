// CrazyGames SDK v3 wrapper. Loads the SDK only on CrazyGames (or with ?crazy); otherwise
// rewarded ads are simulated with a mock modal so trials work everywhere.
let sdk = null; let ready = null;

export function initAds() {
  if (ready) return ready;
  const want = /crazygames/.test(location.hostname) || new URLSearchParams(location.search).has('crazy');
  if (!want) return (ready = Promise.resolve(null));
  ready = new Promise((resolve) => {
    const s = document.createElement('script'); s.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js'; s.async = true;
    s.onload = async () => { try { await window.CrazyGames.SDK.init(); sdk = window.CrazyGames.SDK; } catch { sdk = null; } resolve(sdk); };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return ready;
}

export const gameplay = {
  start() { try { sdk?.game?.gameplayStart(); } catch { /* noop */ } },
  stop() { try { sdk?.game?.gameplayStop(); } catch { /* noop */ } },
  happy() { try { sdk?.game?.happytime(); } catch { /* noop */ } },
};

// Returns Promise<boolean> — true if the reward should be granted.
export async function showRewardedAd(label = 'Reward') {
  await initAds();
  if (sdk) {
    return new Promise((resolve) => {
      try {
        sdk.ad.requestAd('rewarded', { adStarted: () => {}, adFinished: () => resolve(true), adError: () => resolve(mockAd(label)) });
      } catch { mockAd(label).then(resolve); }
    });
  }
  return mockAd(label);
}

export function mockAd(label, seconds = 3) {
  return new Promise((resolve) => {
    const el = document.createElement('div'); el.className = 'ad-modal';
    el.innerHTML = `<div class="ad-box"><div class="ad-tag">SIMULATED AD</div><div class="ad-title">Rewarded video</div>
      <div class="ad-sub">${label}</div><div class="ad-bar"><i></i></div><div class="ad-count">${seconds}</div>
      <button class="btn ghost ad-skip">Cancel</button></div>`;
    document.body.appendChild(el);
    const bar = el.querySelector('.ad-bar i'), cnt = el.querySelector('.ad-count');
    const t0 = performance.now(); const fast = window.__FS_FAST_ADS ? 0.15 : seconds;
    let done = false;
    const finish = (ok) => { if (done) return; done = true; el.remove(); resolve(ok); };
    el.querySelector('.ad-skip').onclick = () => finish(false);
    const tick = () => {
      if (done) return; const u = Math.min(1, (performance.now() - t0) / 1000 / fast);
      bar.style.width = (u * 100).toFixed(1) + '%'; cnt.textContent = Math.ceil(fast * (1 - u));
      if (u >= 1) finish(true); else setTimeout(tick, 50);
    };
    tick();
  });
}
