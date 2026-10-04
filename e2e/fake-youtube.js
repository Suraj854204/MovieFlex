/* Test double for the YouTube IFrame API (the sandbox/CI can't reach youtube.com).
   Mimics the real player's state machine closely enough to exercise our sync logic:
   loadVideoById → BUFFERING(3) → PLAYING(1); cueVideoById → CUED(5); events fire for
   programmatic calls too, exactly like the real player. */
(function () {
  const players = [];
  class Player {
    constructor(el, opts) {
      this.opts = opts; this.events = opts.events || {}; this.state = -1; this.pos = 0; this.t0 = 0; this.vid = null; this.muted = false;
      const box = document.createElement('div'); box.setAttribute('data-fake-yt', ''); box.style.cssText = 'width:100%;height:100%;background:#123';
      el.appendChild(box); this.box = box; players.push(this);
      setTimeout(() => this.events.onReady && this.events.onReady({ target: this }), 30);
    }
    _set(s) { this.state = s; this.box.textContent = `${this.vid || ''}:${s}`; this.events.onStateChange && this.events.onStateChange({ data: s }); }
    getCurrentTime() { return this.state === 1 ? this.pos + (Date.now() - this.t0) / 1000 : this.pos; }
    getPlayerState() { return this.state; }
    getVideoData() { return { video_id: this.vid }; }
    loadVideoById(a) { this.vid = a.videoId; this.pos = a.startSeconds || 0; this.t0 = Date.now(); this._set(3); setTimeout(() => { this.t0 = Date.now(); this._set(1); }, 40); }
    cueVideoById(a) { this.vid = a.videoId; this.pos = a.startSeconds || 0; this._set(5); }
    playVideo() { if (this.state === 1) return; this.t0 = Date.now(); this._set(1); }
    pauseVideo() { if (this.state === 2) return; this.pos = this.getCurrentTime(); this._set(2); }
    seekTo(t) { this.pos = t; this.t0 = Date.now(); }
    mute() { this.muted = true; } unMute() { this.muted = false; } isMuted() { return this.muted; }
    destroy() { const i = players.indexOf(this); if (i >= 0) players.splice(i, 1); this.box.remove(); }
    // ── helpers used by tests to act like a human on the real controls ──
    userPause() { this.pauseVideo(); }
    userPlay() { this.playVideo(); }
    userSeek(t) { this.pos = t; this.t0 = Date.now(); if (this.state === 1) { this._set(3); setTimeout(() => { this.t0 = Date.now(); this._set(1); }, 30); } }
  }
  window.YT = { Player, PlayerState: { PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } };
  window.__yt = { players, current: () => players[players.length - 1] };
  setTimeout(() => window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(), 20);
})();
