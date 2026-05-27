(function () {
  if (typeof d3 === 'undefined' || !document.getElementById('bubble-layer')) return;

  const raw = (window.PORTFOLIO_DATA?.skills || [])
    .filter(s => s.id && s.name && s.visible !== false);
  if (!raw.length) return;

  const catCls = {
    'Concept Art': 'b-concept',
    '2D Tools':    'b-2d',
    '3D & Engine': 'b-3d',
    'Game Dev':    'b-gamedev',
  };

  // ── Bubble sizes: sqrt scale proportional to level ────────────────
  const values   = raw.map(s => Math.max(20, s.level || 50));
  const maxValue = d3.max(values);
  const rScale   = d3.scaleSqrt().domain([0, maxValue]).range([0, 64]);

  const simNodes = raw.map(s => ({
    name:  s.name,
    cat:   s.category || '',
    cls:   catCls[s.category] || 'b-3d',
    value: Math.max(20, s.level || 50),
    icon:  s.icon || '',
    id:    s.id,
    r:     Math.max(28, rScale(Math.max(20, s.level || 50))),
  }));

  // ── Responsive stage sizing ────────────────────────────────────────
  const TOTAL_AREA = d3.sum(simNodes, n => Math.PI * n.r * n.r);
  const DENSITY    = 0.30;
  const STAGE_AREA = TOTAL_AREA / DENSITY;
  const MIN_H = 360, MAX_H = 680;

  const stage = document.getElementById('bubble-stage');
  const svgEl = document.getElementById('bubbles');

  function computeDims() {
    const W = Math.max(320, stage.clientWidth || window.innerWidth);
    const H = Math.max(MIN_H, Math.min(MAX_H, STAGE_AREA / W));
    return { W: Math.round(W), H: Math.round(H) };
  }

  let { W, H } = computeDims();
  stage.style.height = H + 'px';
  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // ── Category cluster centres (2×2 grid, adapts to W/H) ────────────
  function catCentres(W, H) {
    return {
      'Concept Art':  { x: W * 0.28, y: H * 0.40 },
      '2D Tools':     { x: W * 0.70, y: H * 0.32 },
      '3D & Engine':  { x: W * 0.38, y: H * 0.70 },
      'Game Dev':     { x: W * 0.75, y: H * 0.70 },
    };
  }

  let centres = catCentres(W, H);

  // Seed positions near category centre with jitter
  simNodes.forEach(n => {
    const c = centres[n.cat] || { x: W / 2, y: H / 2 };
    n.x = c.x + (Math.random() - 0.5) * 60;
    n.y = c.y + (Math.random() - 0.5) * 60;
  });

  // ── SVG helpers ────────────────────────────────────────────────────
  const layer = document.getElementById('bubble-layer');
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    return el;
  }


  // ── Build bubble DOM ───────────────────────────────────────────────
  const bubbleEls = [];

  simNodes.forEach(d => {
    const { r } = d;

    const gBase = svg('g', { class: 'bubble b-base', transform: `translate(${d.x},${d.y})` });
    gBase.dataset.name = d.name;
    gBase.dataset.cat  = d.cat;

    const gPush = svg('g', { class: 'b-push' });
    gPush.style.setProperty('--pushX', '0px');
    gPush.style.setProperty('--pushY', '0px');

    const ax    = (Math.random() * 4 + 2).toFixed(2);
    const ay    = (Math.random() * 4 + 2).toFixed(2);
    const ayUp  = (-(Math.random() * 4 + 2)).toFixed(2);
    const dur   = (6 + Math.random() * 5).toFixed(2);
    const delay = (-Math.random() * 10).toFixed(2);

    const gFloat = svg('g', { class: 'b-float' });
    gFloat.style.setProperty('--ax',    ax    + 'px');
    gFloat.style.setProperty('--ay',    ay    + 'px');
    gFloat.style.setProperty('--ay-up', ayUp  + 'px');
    gFloat.style.setProperty('--dur',   dur   + 's');
    gFloat.style.setProperty('--delay', delay + 's');

    const gScale = svg('g', { class: 'b-scale' });

    gScale.appendChild(svg('circle', { r, class: 'bubble-ripple' }));
    gScale.appendChild(svg('circle', { r, class: 'b-circle ' + d.cls }));
    gScale.appendChild(svg('circle', { r: r - 5, class: 'b-rim ' + d.cls }));

    if (d.icon) {
      const iconSz = r * 0.72;
      const img = svg('image', {
        href: d.icon,
        x: -iconSz / 2, y: -iconSz / 2,
        width: iconSz, height: iconSz,
        preserveAspectRatio: 'xMidYMid meet',
        filter: d.cls === 'b-concept' ? 'url(#sk-icon-trad)' : 'url(#sk-icon-dig)',
      });
      img.style.pointerEvents = 'none';
      gScale.appendChild(img);
    }

    gFloat.appendChild(gScale);
    gPush.appendChild(gFloat);
    gBase.appendChild(gPush);
    layer.appendChild(gBase);
    bubbleEls.push({ g: gBase, gPush, node: d, r, data: d });
  });

  // ── Force simulation ───────────────────────────────────────────────
  const PAD = 4;

  const sim = d3.forceSimulation(simNodes)
    .velocityDecay(0.28)
    .force('collide', d3.forceCollide(d => d.r + 4).strength(1).iterations(3))
    .force('x', d3.forceX(d => centres[d.cat]?.x ?? W / 2).strength(0.06))
    .force('y', d3.forceY(d => centres[d.cat]?.y ?? H / 2).strength(0.06))
    .on('tick', () => {
      for (const n of simNodes) {
        if (n.x < n.r + PAD)     { n.x = n.r + PAD;     n.vx *= -0.3; }
        if (n.x > W - n.r - PAD) { n.x = W - n.r - PAD; n.vx *= -0.3; }
        if (n.y < n.r + PAD)     { n.y = n.r + PAD;     n.vy *= -0.3; }
        if (n.y > H - n.r - PAD) { n.y = H - n.r - PAD; n.vy *= -0.3; }
      }
      for (const b of bubbleEls) {
        b.g.setAttribute('transform', `translate(${b.node.x.toFixed(2)},${b.node.y.toFixed(2)})`);
      }
    });

  sim.alpha(1).restart();

  // ── Tooltip ────────────────────────────────────────────────────────
  const tooltip = document.getElementById('skill-tooltip');
  const tName   = tooltip.querySelector('.t-name');
  const tCat    = tooltip.querySelector('.t-cat');

  function placeTooltip(b) {
    const sr   = stage.getBoundingClientRect();
    const vr   = svgEl.getBoundingClientRect();
    const scX  = vr.width  / W;
    const scY  = vr.height / H;
    const cx   = vr.left - sr.left + b.node.x * scX;
    const cy   = vr.top  - sr.top  + b.node.y * scY;
    tooltip.style.left = cx + 'px';
    tooltip.style.top  = (cy - b.r * scX) + 'px';
  }

  bubbleEls.forEach(b => {
    b.g.addEventListener('mouseenter', () => {
      tName.textContent = b.data.name;
      tCat.textContent  = b.data.cat;
      placeTooltip(b);
      tooltip.classList.add('active');
    });
    b.g.addEventListener('mouseleave', () => tooltip.classList.remove('active'));
  });

  // ── Mouse repulsion ────────────────────────────────────────────────
  const MAX_DIST = 150, MAX_PUSH = 22;

  stage.addEventListener('mousemove', e => {
    const vr = svgEl.getBoundingClientRect();
    const mx = (e.clientX - vr.left) * (W / vr.width);
    const my = (e.clientY - vr.top)  * (H / vr.height);

    bubbleEls.forEach(b => {
      const dx = b.node.x - mx, dy = b.node.y - my;
      const dist = Math.hypot(dx, dy);
      if (dist < MAX_DIST) {
        const p = (1 - dist / MAX_DIST) * MAX_PUSH;
        const a = Math.atan2(dy, dx);
        b.gPush.style.setProperty('--pushX', (Math.cos(a) * p).toFixed(2) + 'px');
        b.gPush.style.setProperty('--pushY', (Math.sin(a) * p).toFixed(2) + 'px');
      } else {
        b.gPush.style.setProperty('--pushX', '0px');
        b.gPush.style.setProperty('--pushY', '0px');
      }
    });
  });

  stage.addEventListener('mouseleave', () => {
    bubbleEls.forEach(b => {
      b.gPush.style.setProperty('--pushX', '0px');
      b.gPush.style.setProperty('--pushY', '0px');
    });
    tooltip.classList.remove('active');
  });

  // ── Resize ────────────────────────────────────────────────────────
  let resizeTimer;
  function onResize() {
    tooltip.classList.remove('active');
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const dims = computeDims();
      if (dims.W === W && dims.H === H) return;
      W = dims.W; H = dims.H;
      stage.style.height = H + 'px';
      svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
      centres = catCentres(W, H);
      sim
        .force('x', d3.forceX(d => centres[d.cat]?.x ?? W / 2).strength(0.06))
        .force('y', d3.forceY(d => centres[d.cat]?.y ?? H / 2).strength(0.06))
        .alpha(0.55).restart();
    }, 30);
  }

  window.addEventListener('resize', onResize);
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(stage);
})();
