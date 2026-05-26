/* wave.js — Reusable animated wave surface
 * Usage: WaveEffect.init(canvasEl, options?) → destroy()
 * Options: { baseY, colorTop, colorBot, wind, flowSpeed, tiltGain }
 */
window.WaveEffect = (function () {

  class WaveHump {
    constructor({ x, maxAmp, width, vx, lifetime }) {
      this.x = x; this.vx = vx; this.maxAmp = maxAmp;
      this.amp = 0; this.width = width;
      this.age = 0; this.lifetime = lifetime; this.alive = true;
    }
    update(dt) {
      this.age += dt;
      this.x += this.vx * dt;
      const t = this.age / this.lifetime;
      if (t >= 1) { this.alive = false; return; }
      const R = 0.18;
      let e;
      if      (t < R)       e = 0.5 - 0.5 * Math.cos(Math.PI * (t / R));
      else if (t > 1 - R)   e = 0.5 - 0.5 * Math.cos(Math.PI * ((1 - t) / R));
      else                   e = 1;
      this.amp = this.maxAmp * e;
      if (this.x < -this.width * 3) this.alive = false;
    }
    yAt(px) {
      if (this.amp < 0.05) return 0;
      const s = (px - this.x) / this.width;
      return -this.amp * Math.exp(-s * s);
    }
  }

  function init(canvas, opts) {
    opts = Object.assign({
      baseY:      0.42,
      colorTop:   'rgba(92,48,128,0.95)',
      colorBot:   'rgba(15,4,30,1)',
      wind:       1.6,
      flowSpeed:  1.4,
      tiltGain:   1.0,
      spawnRate:  null
    }, opts || {});

    const ctx = canvas.getContext('2d');
    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let W = 0, H = 0;
    const waves = [];
    let nextSpawnIn = 0.3;
    let tilt = 0, targetTilt = 0;
    let rafId = null;
    let lastT = performance.now();
    let destroyed = false;

    function resize() {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width  = Math.max(1, Math.floor(W * DPR));
      canvas.height = Math.max(1, Math.floor(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    const tiltYAt = x => -Math.tan(tilt) * (x - W / 2);
    const baseY   = ()  => H * (typeof opts.baseY === 'function' ? opts.baseY() : opts.baseY);

    function surfaceY(x) {
      let h = 0;
      for (let i = 0; i < waves.length; i++) h += waves[i].yAt(x);
      return baseY() + tiltYAt(x) + h;
    }

    function spawnWave() {
      const wild     = Math.random();
      const maxAmp   = (16 + 44 * wild) * opts.wind;
      const width    = 110 + Math.random() * 180;
      const vx       = -(140 + Math.random() * 120) * opts.flowSpeed;
      const travel   = W * 1.4 + width * 4;
      const lifetime = (travel / -vx) * 1.05;
      waves.push(new WaveHump({ x: W + width * 1.5, maxAmp, width, vx, lifetime }));
    }

    function update(dt) {
      for (let i = waves.length - 1; i >= 0; i--) {
        waves[i].update(dt);
        if (!waves[i].alive) waves.splice(i, 1);
      }
      nextSpawnIn -= dt;
      if (nextSpawnIn <= 0) {
        spawnWave();
        nextSpawnIn = (0.5 + Math.random() * 1.1) / Math.max(0.4, opts.spawnRate ?? opts.wind);
      }
    }

    function render() {
      ctx.clearRect(0, 0, W, H);
      const STEP = 6;
      const pts = [];
      for (let x = -20; x <= W + 20; x += STEP) pts.push({ x, y: surfaceY(x) });

      ctx.beginPath();
      ctx.moveTo(pts[0].x, H + 50);
      ctx.lineTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const mx = (pts[i-1].x + pts[i].x) / 2;
        const my = (pts[i-1].y + pts[i].y) / 2;
        ctx.quadraticCurveTo(pts[i-1].x, pts[i-1].y, mx, my);
      }
      ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
      ctx.lineTo(pts[pts.length-1].x, H + 50);
      ctx.closePath();

      const g = ctx.createLinearGradient(0, baseY() - 80, 0, H);
      g.addColorStop(0, opts.colorTop);
      g.addColorStop(1, opts.colorBot);
      ctx.fillStyle = g;
      ctx.fill();
    }

    resize();

    // Pre-seed waves spread across full width so surface is waved from frame 1
    for (let i = 0; i < 9; i++) {
      spawnWave();
      const w = waves[waves.length - 1];
      w.age = (0.25 + Math.random() * 0.5) * w.lifetime;
      w.x   = W * (Math.random() * 1.05 - 0.02);
    }

    function loop(t) {
      if (destroyed) return;
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      tilt += (targetTilt - tilt) * 0.06;
      update(dt);
      render();
      rafId = requestAnimationFrame(loop);
    }

    function onOrientation(e) {
      if (e.gamma == null) return;
      targetTilt = Math.max(-40, Math.min(40, e.gamma)) * (Math.PI / 180) * opts.tiltGain;
    }

    if (typeof DeviceOrientationEvent !== 'undefined') {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ (Safari, Arc, Brave) — permission must come from a user gesture.
        // Listen for both touchstart and click so any first interaction triggers it.
        let requested = false;
        function requestOrientationPermission() {
          if (requested) return;
          requested = true;
          document.removeEventListener('touchstart', requestOrientationPermission);
          document.removeEventListener('click',      requestOrientationPermission);
          DeviceOrientationEvent.requestPermission()
            .then(s => { if (s === 'granted') window.addEventListener('deviceorientation', onOrientation); })
            .catch(() => {});
        }
        document.addEventListener('touchstart', requestOrientationPermission);
        document.addEventListener('click',      requestOrientationPermission);
      } else {
        window.addEventListener('deviceorientation', onOrientation);
      }
    }

    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    rafId = requestAnimationFrame(loop);

    return function destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('deviceorientation', onOrientation);
    };
  }

  return { init };
})();
