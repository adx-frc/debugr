(function () {
  if (window.top !== window.self) return;

  // =========================================================
  // REOPEN EXISTING DEBUGR
  // =========================================================

  if (window.__QAI_v10) {
    const existingPanel = document.getElementById('qai-panel');
    const existingIcon = document.getElementById('qai-collapsed');

    if (existingPanel) {
      existingPanel.style.setProperty('display', 'block', 'important');
      existingPanel.style.setProperty('visibility', 'visible', 'important');
      existingPanel.style.setProperty('opacity', '1', 'important');

      if (existingIcon) {
        existingIcon.style.setProperty('display', 'none', 'important');
      }

      existingPanel.scrollLeft = 0;

      const top = document.getElementById('qai-top');
      const panels = document.getElementById('qai-panels');

      if (top) top.scrollLeft = 0;
      if (panels) panels.scrollLeft = 0;

      try {
        localStorage.removeItem('__qai_collapsed');
      } catch {}

      return;
    }

    window.__QAI_v10 = false;
  }

  window.__QAI_v10 = true;

  // =========================================================
  // HELPERS
  // =========================================================

  const esc = s =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  function rectSize(el) {
    const r = el?.getBoundingClientRect?.();

    return r
      ? {
          w: Math.round(r.width || 0),
          h: Math.round(r.height || 0)
        }
      : {
          w: 0,
          h: 0
        };
  }

  function declaredSize(el) {
    const fmt = el.getAttribute('data-ad-format');

    if (
      fmt &&
      fmt !== 'auto' &&
      /^\d+x\d+$/i.test(fmt)
    ) {
      return fmt;
    }

    if (fmt === 'auto') {
      return 'auto';
    }

    const st = (el.getAttribute('style') || '').toLowerCase();

    const w = (
      /width:\s*([\d.]+)px/.exec(st) || []
    )[1];

    const h = (
      /height:\s*([\d.]+)px/.exec(st) || []
    )[1];

    if (w && h) {
      return `${Math.round(+w)}x${Math.round(+h)}`;
    }

    const aw = el.getAttribute('width');
    const ah = el.getAttribute('height');

    if (aw && ah) {
      return `${aw}x${ah}`;
    }

    return '';
  }

  function ensurePositioned(el) {
    try {
      const cs = window.getComputedStyle(el);

      if (cs && cs.position === 'static') {
        el.style.position = 'relative';
      }
    } catch {}
  }

  function getViewport() {
    const vv = window.visualViewport;

    return {
      width:
        vv?.width ||
        window.innerWidth ||
        document.documentElement.clientWidth ||
        360,

      height:
        vv?.height ||
        window.innerHeight ||
        document.documentElement.clientHeight ||
        640,

      left:
        vv?.offsetLeft || 0,

      top:
        vv?.offsetTop || 0
    };
  }

  function isMobileViewport() {
    return getViewport().width <= 700;
  }

  // =========================================================
  // HEADER BIDDING
  // =========================================================

  function detectHB(targeting) {
    const targetingObj = targeting || {};
    const keys = Object.keys(targetingObj);

    const prebidKeys = [];
    const amazonKeys = [];
    const otherHbKeys = [];

    keys.forEach(key => {
      const lower = String(key).toLowerCase();

      if (
        lower === 'hb_bidder' ||
        lower === 'hb_pb' ||
        lower === 'hb_adid' ||
        lower === 'hb_size' ||
        lower === 'hb_source' ||
        lower === 'hb_format' ||
        lower === 'hb_deal' ||
        lower === 'hb_cache_host' ||
        lower === 'hb_uuid' ||
        lower === 'hb_env' ||
        lower === 'hb_tmax' ||
        lower.startsWith('hb_')
      ) {
        prebidKeys.push(key);
        return;
      }

      if (
        lower.startsWith('amzn') ||
        lower.startsWith('amazon')
      ) {
        amazonKeys.push(key);
        return;
      }

      if (
        lower === 'prebid' ||
        lower === 'prebid_bidder' ||
        lower === 'headerbid' ||
        lower === 'header_bidding'
      ) {
        otherHbKeys.push(key);
      }
    });

    const engines = [];

    if (prebidKeys.length) {
      engines.push('Prebid');
    }

    if (amazonKeys.length) {
      engines.push('Amazon');
    }

    if (otherHbKeys.length) {
      engines.push('HB');
    }

    const allKeys = [
      ...prebidKeys,
      ...amazonKeys,
      ...otherHbKeys
    ];

    return {
      active: allKeys.length > 0,
      engines,
      keys: allKeys,
      prebidKeys,
      amazonKeys,
      otherHbKeys
    };
  }

  function detectPageHB() {
    const prebid = !!(
      window.pbjs &&
      (
        Array.isArray(window.pbjs.que) ||
        typeof window.pbjs.getBidResponses === 'function' ||
        typeof window.pbjs.requestBids === 'function'
      )
    );

    const amazon = !!(
      window.apstag &&
      (
        typeof window.apstag.fetchBids === 'function' ||
        typeof window.apstag.setDisplayBids === 'function' ||
        Array.isArray(window.apstag._Q)
      )
    );

    return {
      prebid,
      amazon,
      any: prebid || amazon
    };
  }

  function hbBadgeHTML(hb) {
    if (hb?.active) {
      const label = hb.engines?.length
        ? hb.engines.join(' + ')
        : 'HB';

      return `
        <span class="qai-hb qai-hb-yes">
          HB ✓
          <span class="qai-hb-engine">
            ${esc(label)}
          </span>
        </span>
      `;
    }

    return `
      <span class="qai-hb qai-hb-no">
        HB ✕
      </span>
    `;
  }

  // =========================================================
  // SLOT OVERLAYS
  // =========================================================

  function addBadge(el, num) {
    if (!el) return;

    const old = el.querySelector?.('.qai-slot-badge');

    if (old) {
      old.remove();
    }

    ensurePositioned(el);

    const b = document.createElement('div');

    b.className = 'qai-slot-badge';
    b.textContent = String(num);

    b.style.cssText = [
      'position:absolute',
      'right:3px',
      'bottom:2px',
      'background:#5b3d8a',
      'color:#fff',
      'font-size:11px',
      'font-weight:bold',
      'border-radius:50%',
      'width:16px',
      'height:16px',
      'text-align:center',
      'line-height:16px',
      'opacity:.9',
      'box-shadow:0 0 2px rgba(0,0,0,.3)',
      'pointer-events:none',
      'z-index:2147483647'
    ].join(';');

    const r = rectSize(el);

    if (r.h && r.h < 50) {
      b.style.bottom = '6px';
    }

    el.appendChild(b);
  }

  function addSlotOverlay(el, num, lines) {
    if (!el) return;

    const old = el.querySelector?.('.qai-slot-overlay');

    if (old) {
      old.remove();
    }

    ensurePositioned(el);

    const o = document.createElement('div');

    o.className = 'qai-slot-overlay';

    o.style.cssText = [
      'position:absolute',
      'left:3px',
      'bottom:2px',
      'max-width:70%',
      'background:rgba(255,235,175,.72)',
      'backdrop-filter:blur(6px)',
      '-webkit-backdrop-filter:blur(6px)',
      'border:1px solid rgba(91,61,138,.25)',
      'border-radius:8px',
      'padding:4px 6px',
      'font:11px Arial,sans-serif',
      'color:#2b1e45',
      'box-shadow:0 2px 8px rgba(0,0,0,.15)',
      'pointer-events:none',
      'z-index:2147483647',
      'white-space:nowrap',
      'overflow:hidden',
      'text-overflow:ellipsis'
    ].join(';');

    const safeLines = (lines || []).map(esc);

    o.innerHTML = `<b>#${num}</b> ${safeLines.join('<br>')}`;

    const r = rectSize(el);

    if (r.h && r.h < 70) {
      o.style.bottom = '24px';
    }

    el.appendChild(o);
  }

  // =========================================================
  // CSS
  // =========================================================

  const qaiStyle = document.createElement('style');

  qaiStyle.id = 'qai-style';

  qaiStyle.textContent = `
    #qai-panel,
    #qai-panel * {
      box-sizing:border-box !important;
    }

    #qai-panel {
      width:560px;
      max-width:calc(100vw - 20px);
      max-height:70vh;
      overflow:hidden !important;
    }

    #qai-header {
      display:flex;
      align-items:center;
      flex-wrap:wrap;
      gap:6px;
      width:100%;
      min-width:0;
    }

    #qai-title {
      font-size:13px;
      font-weight:700;
      flex:0 0 auto;
    }

    #qai-controls {
      display:flex;
      flex-wrap:wrap;
      gap:5px;
      min-width:0;
    }

    #qai-panel button {
      font:12px Arial,sans-serif !important;
      padding:4px 7px !important;
      min-height:27px;
      border:1px solid #999;
      border-radius:4px;
      background:#f8f8f8;
      color:#222;
    }

    #qai-body {
      display:flex;
      flex-direction:column;
      gap:8px;
      width:100%;
      min-width:0;
      max-height:calc(70vh - 44px);
      overflow:hidden;
    }

    #qai-head {
      width:100%;
      min-width:0;
      flex:0 0 auto;
      overflow-wrap:anywhere;
    }

    #qai-top {
      flex:0 0 auto;
      width:100%;
      min-width:0;
      max-height:28vh;
      overflow:auto;
      -webkit-overflow-scrolling:touch;
    }

    #qai-slots {
      width:100%;
      min-width:0;
    }

    #qai-panels {
      flex:1 1 auto;
      width:100%;
      min-width:0;
      overflow:auto;
      -webkit-overflow-scrolling:touch;
    }

    .qai-desktop-only {
      display:block;
    }

    .qai-mobile-only {
      display:none;
    }

    #qai-panel .qai-table {
      border-collapse:collapse;
      margin-top:4px;
      font-size:11px;
      width:100%;
    }

    #qai-panel .qai-table thead tr {
      background:rgba(233,221,255,.35) !important;
    }

    #qai-panel .qai-table th {
      background:rgba(233,221,255,.25);
    }

    #qai-panel .qai-table td {
      background:rgba(245,240,255,.18);
    }

    #qai-panel .qai-table td,
    #qai-panel .qai-table th {
      border:1px solid rgba(209,196,255,.55) !important;
      padding:4px 6px;
      vertical-align:top;
    }

    .qai-hb {
      display:inline-block;
      padding:2px 6px;
      border-radius:5px;
      font-weight:700;
      white-space:nowrap;
    }

    .qai-hb-yes {
      background:#dff5e5;
      border:1px solid #83c996;
      color:#176b2c;
    }

    .qai-hb-no {
      background:#ffe1e1;
      border:1px solid #e49a9a;
      color:#a31d1d;
    }

    .qai-hb-engine {
      font-weight:400;
    }

    #qai-panel .qai-det {
      position:relative;
      width:100%;
      min-width:0;
      max-width:100%;
      margin:6px 0;
      border:1px dashed rgba(215,202,255,.6);
      border-radius:8px;
      padding:8px 8px 24px;
      background:rgba(245,240,255,.25);
      overflow:hidden;
    }

    #qai-panel .qai-sum {
      cursor:pointer;
      font-weight:600;
      background:rgba(233,221,255,.22);
      padding:5px 6px;
      border-radius:6px;
      white-space:normal;
      overflow-wrap:anywhere;
      word-break:break-word;
    }

    #qai-panel .qai-mismatch {
      background:rgba(255,120,120,.22) !important;
    }

    .qai-mobile-list {
      display:flex;
      flex-direction:column;
      gap:8px;
      width:100%;
      min-width:0;
    }

    .qai-mobile-card {
      width:100%;
      min-width:0;
      max-width:100%;
      border:1px solid rgba(91,61,138,.25);
      border-radius:9px;
      background:rgba(248,245,255,.72);
      padding:8px;
      overflow:hidden;
    }

    .qai-mobile-card-head {
      display:flex;
      align-items:center;
      gap:6px;
      flex-wrap:wrap;
      width:100%;
      min-width:0;
      margin-bottom:7px;
    }

    .qai-mobile-num {
      background:#5b3d8a;
      color:white;
      border-radius:12px;
      padding:2px 7px;
      font-weight:700;
      flex:0 0 auto;
    }

    .qai-mobile-type {
      font-weight:700;
      flex:0 0 auto;
    }

    .qai-mobile-row {
      display:grid;
      grid-template-columns:82px minmax(0,1fr);
      column-gap:6px;
      margin:4px 0;
      width:100%;
      min-width:0;
    }

    .qai-mobile-label {
      color:#685c7d;
      font-size:11px;
      font-weight:600;
    }

    .qai-mobile-value {
      min-width:0;
      font-size:11px;
      overflow-wrap:anywhere;
      word-break:break-word;
      white-space:normal;
    }

    .qai-mobile-actions {
      margin-top:8px;
      display:flex;
      gap:6px;
      flex-wrap:wrap;
    }

    .qai-mobile-targeting {
      margin-top:7px;
      width:100%;
      max-height:140px;
      overflow:auto;
      border-top:1px solid rgba(91,61,138,.16);
      padding-top:6px;
      font:10px/1.4 monospace;
      white-space:pre-wrap;
      overflow-wrap:anywhere;
      word-break:break-word;
      -webkit-overflow-scrolling:touch;
    }

    @media (max-width:700px) {
      #qai-panel {
        margin:0 !important;
        padding:8px !important;
        overflow:hidden !important;
        border-radius:10px !important;
      }

      #qai-header {
        display:block !important;
      }

      #qai-title {
        display:block !important;
        margin-bottom:6px !important;
      }

      #qai-controls {
        display:grid !important;
        grid-template-columns:repeat(3,minmax(0,1fr)) !important;
        width:100% !important;
        gap:5px !important;
      }

      #qai-panel button {
        width:100% !important;
        max-width:100% !important;
        padding:6px 4px !important;
        font-size:11px !important;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      #qai-body {
        width:100% !important;
        min-width:0 !important;
        max-width:100% !important;
        overflow:hidden !important;
      }

      #qai-head {
        width:100% !important;
        min-width:0 !important;
        max-width:100% !important;
        font-size:11px !important;
      }

      #qai-top {
        width:100% !important;
        min-width:0 !important;
        max-width:100% !important;
        overflow-x:hidden !important;
        overflow-y:auto !important;
      }

      #qai-slots {
        width:100% !important;
        min-width:0 !important;
        max-width:100% !important;
        overflow:hidden !important;
      }

      #qai-panels {
        width:100% !important;
        min-width:0 !important;
        max-width:100% !important;
        overflow-x:hidden !important;
        overflow-y:auto !important;
      }

      .qai-desktop-only {
        display:none !important;
      }

      .qai-mobile-only {
        display:block !important;
      }

      #qai-panel .qai-det {
        width:100% !important;
        min-width:0 !important;
        max-width:100% !important;
      }

      #qai-panel .qai-sum {
        width:100% !important;
        min-width:0 !important;
        max-width:100% !important;
      }
    }
  `;

  (document.head || document.documentElement).appendChild(qaiStyle);

  // =========================================================
  // STATE
  // =========================================================

  const S = {
    lastScan: 0,
    showPH: false,
    adsense: [],
    gam: [],
    hbPage: {
      prebid: false,
      amazon: false,
      any: false
    },
    collapsed: false
  };

  // =========================================================
  // SCANNERS
  // =========================================================

  function scanAdsense() {
    const list = Array.from(
      document.querySelectorAll('ins.adsbygoogle')
    );

    return list.map((el, i) => {
      if (!el.id) {
        el.id = `qai-adsense-${i + 1}`;
      }

      const client =
        el.getAttribute('data-ad-client') ||
        window.google_ad_client ||
        '';

      const slot =
        el.getAttribute('data-ad-slot') ||
        '';

      const ds = declaredSize(el);
      const rc = rectSize(el);

      const cs = `${rc.w}x${rc.h}`;

      const format =
        el.getAttribute('data-ad-format') ||
        '';

      const isPlaceholder =
        !client &&
        !slot &&
        ds === '' &&
        (rc.w === 0 || rc.h === 0);

      const isUninitialized =
        !client &&
        !slot &&
        !isPlaceholder;

      return {
        elementId: el.id,
        domIndex: i,
        client,
        slot,
        declared: ds,
        computed: cs,
        format,
        state: isPlaceholder
          ? 'placeholder'
          : (
              isUninitialized
                ? 'uninitialized'
                : 'normal'
            )
      };
    });
  }

  function scanGAM() {
    try {
      if (!(window.googletag?.pubads)) {
        return [];
      }

      const slots =
        window.googletag.pubads().getSlots?.() ||
        [];

      return slots.map(s => {
        let sizesArr = [];

        try {
          const arr = s.getSizes?.() || [];

          sizesArr = arr
            .map(o => {
              if (o?.getWidth) {
                return `${o.getWidth()}x${o.getHeight()}`;
              }

              if (o?.w && o?.h) {
                return `${o.w}x${o.h}`;
              }

              return '';
            })
            .filter(Boolean);
        } catch {}

        sizesArr = Array.from(
          new Set(sizesArr)
        );

        let targeting = {};

        try {
          const keys =
            s.getTargetingKeys?.() ||
            [];

          keys.forEach(k => {
            targeting[k] =
              s.getTargeting?.(k) ||
              [];
          });
        } catch {}

        const hb = detectHB(targeting);

        return {
          adUnitPath:
            s.getAdUnitPath?.() ||
            '',

          slotElementId:
            s.getSlotElementId?.() ||
            '',

          sizesArr,

          sizesStr:
            sizesArr.join('|'),

          targeting,

          hb
        };
      });
    } catch {
      return [];
    }
  }

  function rescan() {
    S.adsense = scanAdsense();
    S.gam = scanGAM();
    S.hbPage = detectPageHB();
    S.lastScan = Date.now();
  }

  // =========================================================
  // PANEL
  // =========================================================

  const panel = document.createElement('div');

  panel.id = 'qai-panel';

  panel.style.cssText = [
    'position:fixed',
    'right:10px',
    'top:10px',
    'z-index:2147483646',
    'background:rgba(245,240,255,.95)',
    'backdrop-filter:blur(10px)',
    '-webkit-backdrop-filter:blur(10px)',
    'border:1px solid rgba(91,61,138,.35)',
    'padding:10px',
    'font:12px Arial,sans-serif',
    'color:#221a33',
    'box-shadow:0 6px 18px rgba(0,0,0,.25)',
    'border-radius:10px',
    'visibility:visible',
    'opacity:1',
    'box-sizing:border-box'
  ].join(';');

  panel.innerHTML = `
    <div id="qai-header">

      <div id="qai-title">
        Debugr
      </div>

      <div id="qai-controls">
        <button id="qai-r">
          Refresh
        </button>

        <button id="qai-ph">
          Show placeholders
        </button>

        <button id="qai-min">
          Minimize
        </button>
      </div>

    </div>

    <div id="qai-body">

      <div
        id="qai-head"
        style="margin-top:8px"
      ></div>

      <div id="qai-top">
        <div id="qai-slots"></div>
      </div>

      <div id="qai-panels"></div>

    </div>
  `;

  document.documentElement.appendChild(panel);

  // =========================================================
  // COLLAPSED ICON
  // =========================================================

  const icon = document.createElement('div');

  icon.id = 'qai-collapsed';
  icon.textContent = 'Ad';
  icon.title = 'Open Debugr';

  icon.style.cssText = [
    'position:fixed',
    'right:10px',
    'top:10px',
    'width:38px',
    'height:38px',
    'border-radius:50%',
    'background:#5b3d8a',
    'color:#fff',
    'display:none',
    'align-items:center',
    'justify-content:center',
    'font:12px Arial,sans-serif',
    'z-index:2147483647',
    'box-shadow:0 6px 18px rgba(0,0,0,.25)',
    'cursor:pointer',
    'user-select:none'
  ].join(';');

  document.documentElement.appendChild(icon);

  // =========================================================
  // VIEWPORT FIT
  // =========================================================

  function fitPanelToViewport() {
    const vp = getViewport();
    const mobile = vp.width <= 700;

    if (mobile) {
      const gap = 6;

      const width =
        Math.max(
          220,
          Math.floor(vp.width - gap * 2)
        );

      const height =
        Math.max(
          260,
          Math.floor(vp.height * 0.78)
        );

      panel.style.setProperty(
        'position',
        'fixed',
        'important'
      );

      panel.style.setProperty(
        'left',
        `${Math.round(vp.left + gap)}px`,
        'important'
      );

      panel.style.setProperty(
        'right',
        'auto',
        'important'
      );

      panel.style.setProperty(
        'top',
        `${Math.round(vp.top + gap)}px`,
        'important'
      );

      panel.style.setProperty(
        'width',
        `${width}px`,
        'important'
      );

      panel.style.setProperty(
        'min-width',
        `${width}px`,
        'important'
      );

      panel.style.setProperty(
        'max-width',
        `${width}px`,
        'important'
      );

      panel.style.setProperty(
        'max-height',
        `${height}px`,
        'important'
      );

      panel.style.setProperty(
        'overflow',
        'hidden',
        'important'
      );

      const body =
        document.getElementById('qai-body');

      if (body) {
        body.style.setProperty(
          'max-height',
          `${Math.max(180, height - 86)}px`,
          'important'
        );
      }

      const top =
        document.getElementById('qai-top');

      if (top) {
        top.style.setProperty(
          'max-height',
          `${Math.max(140, Math.floor(height * 0.42))}px`,
          'important'
        );
      }
    } else {
      panel.style.removeProperty('left');
      panel.style.removeProperty('min-width');

      panel.style.setProperty(
        'right',
        '10px',
        'important'
      );

      panel.style.setProperty(
        'top',
        '10px',
        'important'
      );

      panel.style.setProperty(
        'width',
        '560px',
        'important'
      );

      panel.style.setProperty(
        'max-width',
        'calc(100vw - 20px)',
        'important'
      );

      panel.style.setProperty(
        'max-height',
        '70vh',
        'important'
      );
    }

    resetPanelScroll();
  }

  function resetPanelScroll() {
    [
      panel,
      document.getElementById('qai-body'),
      document.getElementById('qai-top'),
      document.getElementById('qai-slots'),
      document.getElementById('qai-panels')
    ].forEach(el => {
      if (!el) return;

      try {
        el.scrollLeft = 0;
      } catch {}
    });
  }

  // =========================================================
  // DATA HELPERS
  // =========================================================

  function visibleAdsense() {
    return S.showPH
      ? S.adsense
      : S.adsense.filter(
          s => s.state !== 'placeholder'
        );
  }

  function makeTargetingText(targeting, maxKeys = 50) {
    return Object.keys(targeting || {})
      .slice(0, maxKeys)
      .map(
        k =>
          `${k} = ${(targeting[k] || []).join('|')}`
      )
      .join('\n');
  }

  // =========================================================
  // HEADER SUMMARY
  // =========================================================

  function renderHead() {
    const Aall = S.adsense;
    const A = visibleAdsense();

    const ph =
      Aall.length -
      A.length;

    const G =
      S.gam.length;

    const hbSlots =
      S.gam.filter(g => g.hb?.active).length;

    const pageEngines = [];

    if (S.hbPage.prebid) {
      pageEngines.push('Prebid');
    }

    if (S.hbPage.amazon) {
      pageEngines.push('Amazon');
    }

    let hbPageHtml = '';

    if (S.hbPage.any) {
      hbPageHtml = `
        <span
          style="
            color:#176b2c;
            font-weight:600
          "
        >
          | HB library:
          ${esc(pageEngines.join(' + '))}
        </span>
      `;
    }

    document.getElementById('qai-head').innerHTML = `
      <div>
        AdSense:
        <b>${A.length}</b>

        ${
          ph
            ? ` (+${ph} hidden)`
            : ''
        }

        |

        GAM:
        <b>${G}</b>

        |

        HB:
        <b>${hbSlots}/${G}</b>

        ${hbPageHtml}
      </div>

      <div
        style="
          color:#4b3a6b;
          font-size:10px;
          margin-top:2px
        "
      >
        ${new Date(S.lastScan).toLocaleTimeString()}
      </div>
    `;

    document.getElementById('qai-ph').textContent =
      S.showPH
        ? 'Hide placeholders'
        : 'Show placeholders';
  }

  // =========================================================
  // DESKTOP TABLES
  // =========================================================

  function renderDesktopTables() {
    const A = visibleAdsense();
    const base = A.length;

    let html = `
      <div class="qai-desktop-only">
    `;

    if (A.length) {
      html += `
        <div
          style="
            margin-top:6px;
            font-weight:600
          "
        >
          AdSense slot details
        </div>

        <table class="qai-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Publisher ID</th>
              <th>Slot ID</th>
              <th>Declared</th>
              <th>Computed</th>
              <th>Format</th>
              <th>Element ID</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
      `;

      A.forEach((s, i) => {
        const mismatch =
          s.declared &&
          s.declared !== 'auto' &&
          s.computed &&
          s.declared !== s.computed;

        html += `
          <tr>
            <td>${i + 1}</td>
            <td>${esc(s.client)}</td>
            <td>${esc(s.slot)}</td>
            <td>${esc(s.declared)}</td>

            <td class="${mismatch ? 'qai-mismatch' : ''}">
              ${esc(s.computed)}
            </td>

            <td>${esc(s.format)}</td>
            <td>${esc(s.elementId)}</td>
            <td>${esc(s.state)}</td>
          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      `;
    }

    if (S.gam.length) {
      html += `
        <div
          style="
            margin-top:10px;
            font-weight:600
          "
        >
          GAM slot details
        </div>

        <table class="qai-table">
          <thead>
            <tr>
              <th>#</th>
              <th>HB</th>
              <th>AdUnitPath</th>
              <th>SlotElementId</th>
              <th>Sizes</th>
              <th>Targeting</th>
            </tr>
          </thead>
          <tbody>
      `;

      S.gam.forEach((g, idx) => {
        const num =
          base +
          idx +
          1;

        const tgt =
          Object.keys(g.targeting || {})
            .slice(0, 20)
            .map(
              k =>
                `${esc(k)}=${esc(
                  (g.targeting[k] || []).join('|')
                )}`
            )
            .join('; ');

        html += `
          <tr>
            <td>${num}</td>
            <td>${hbBadgeHTML(g.hb)}</td>
            <td>${esc(g.adUnitPath)}</td>
            <td>${esc(g.slotElementId)}</td>
            <td>${esc(g.sizesStr)}</td>
            <td>${tgt}</td>
          </tr>
        `;
      });

      html += `
          </tbody>
        </table>
      `;
    }

    html += `
      </div>
    `;

    return html;
  }

  // =========================================================
  // MOBILE CARDS
  // =========================================================

  function renderMobileCards() {
    const A = visibleAdsense();
    const base = A.length;

    let html = `
      <div class="qai-mobile-only">
        <div class="qai-mobile-list">
    `;

    A.forEach((s, i) => {
      const num = i + 1;

      html += `
        <div class="qai-mobile-card">

          <div class="qai-mobile-card-head">
            <span class="qai-mobile-num">
              #${num}
            </span>

            <span class="qai-mobile-type">
              AdSense
            </span>
          </div>

          <div class="qai-mobile-row">
            <div class="qai-mobile-label">
              Publisher
            </div>

            <div class="qai-mobile-value">
              ${esc(s.client || '-')}
            </div>
          </div>

          <div class="qai-mobile-row">
            <div class="qai-mobile-label">
              Slot
            </div>

            <div class="qai-mobile-value">
              ${esc(s.slot || '-')}
            </div>
          </div>

          <div class="qai-mobile-row">
            <div class="qai-mobile-label">
              Size
            </div>

            <div class="qai-mobile-value">
              ${esc(s.declared || '-')}
              →
              ${esc(s.computed || '-')}
            </div>
          </div>

          <div class="qai-mobile-row">
            <div class="qai-mobile-label">
              Format
            </div>

            <div class="qai-mobile-value">
              ${esc(s.format || '-')}
            </div>
          </div>

          <div class="qai-mobile-row">
            <div class="qai-mobile-label">
              Element
            </div>

            <div class="qai-mobile-value">
              ${esc(s.elementId || '-')}
            </div>
          </div>

          <div class="qai-mobile-row">
            <div class="qai-mobile-label">
              State
            </div>

            <div class="qai-mobile-value">
              ${esc(s.state)}
            </div>
          </div>

          <div class="qai-mobile-actions">
            <button
              class="qai-hl"
              data-kind="adsense"
              data-el="${esc(s.elementId)}"
              data-idx="${s.domIndex}"
            >
              Highlight
            </button>
          </div>

        </div>
      `;
    });

    S.gam.forEach((g, idx) => {
      const num =
        base +
        idx +
        1;

      const targetingText =
        makeTargetingText(
          g.targeting,
          50
        );

      html += `
        <div class="qai-mobile-card">

          <div class="qai-mobile-card-head">
            <span class="qai-mobile-num">
              #${num}
            </span>

            <span class="qai-mobile-type">
              GAM
            </span>

            ${hbBadgeHTML(g.hb)}
          </div>

          <div class="qai-mobile-row">
            <div class="qai-mobile-label">
              Ad unit
            </div>

            <div class="qai-mobile-value">
              ${esc(g.adUnitPath || '-')}
            </div>
          </div>

          <div class="qai-mobile-row">
            <div class="qai-mobile-label">
              Element
            </div>

            <div class="qai-mobile-value">
              ${esc(g.slotElementId || '-')}
            </div>
          </div>

          <div class="qai-mobile-row">
            <div class="qai-mobile-label">
              Sizes
            </div>

            <div class="qai-mobile-value">
              ${esc(g.sizesStr || '-')}
            </div>
          </div>

          <div class="qai-mobile-row">
            <div class="qai-mobile-label">
              HB
            </div>

            <div class="qai-mobile-value">
              ${
                g.hb?.active
                  ? `YES — ${esc(
                      g.hb.engines?.join(' + ') || 'detected'
                    )}`
                  : 'NO'
              }
            </div>
          </div>

          <div class="qai-mobile-actions">
            <button
              class="qai-hl"
              data-kind="gam"
              data-el="${esc(g.slotElementId)}"
            >
              Highlight
            </button>
          </div>

          ${
            targetingText
              ? `
                <details style="margin-top:8px">
                  <summary
                    style="
                      cursor:pointer;
                      font-size:11px;
                      font-weight:600
                    "
                  >
                    Targeting
                  </summary>

                  <div class="qai-mobile-targeting">
${esc(targetingText)}
                  </div>
                </details>
              `
              : ''
          }

        </div>
      `;
    });

    if (!A.length && !S.gam.length) {
      html += `
        <div
          style="
            padding:10px;
            color:#6a5aa4
          "
        >
          No ad slots detected.
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    return html;
  }

  // =========================================================
  // MAIN SLOT LIST
  // =========================================================

  function renderTables() {
    const wrap =
      document.getElementById('qai-slots');

    wrap.innerHTML =
      renderDesktopTables() +
      renderMobileCards();

    attachHighlightHandlers(wrap);
  }

  // =========================================================
  // DESKTOP DETAIL PANELS
  // =========================================================

  function renderPanels() {
    const box =
      document.getElementById('qai-panels');

    box.innerHTML = '';

    if (isMobileViewport()) {
      box.style.display = 'none';
      return;
    }

    box.style.display = 'block';

    const A =
      visibleAdsense();

    const base =
      A.length;

    if (A.length || S.gam.length) {
      const h =
        document.createElement('div');

      h.style =
        'margin-top:2px;font-weight:600';

      h.textContent =
        'Per-slot panels';

      box.appendChild(h);
    }

    const makeCornerBadge = num => {
      const b =
        document.createElement('div');

      b.textContent =
        num;

      b.style =
        'position:absolute;right:6px;bottom:6px;background:#5b3d8a;color:#fff;border-radius:12px;padding:2px 7px;font-size:12px;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,.25)';

      return b;
    };

    A.forEach((s, i) => {
      const num =
        i + 1;

      const det =
        document.createElement('details');

      det.className =
        'qai-det';

      const sum =
        document.createElement('summary');

      sum.className =
        'qai-sum';

      sum.innerHTML = `
        #${num}
        [AdSense]
        ${esc(s.client || '-')}
        /
        ${esc(s.slot || '-')}

        &nbsp;

        <button
          data-kind="adsense"
          data-el="${esc(s.elementId)}"
          data-idx="${s.domIndex}"
          class="qai-hl"
        >
          Highlight
        </button>
      `;

      const mismatch =
        s.declared &&
        s.declared !== 'auto' &&
        s.computed &&
        s.declared !== s.computed;

      const inner =
        document.createElement('div');

      inner.style =
        'margin-top:6px;font-size:11px';

      inner.innerHTML = `
        <div>
          Element ID:
          <b>${esc(s.elementId || '')}</b>
        </div>

        <div>
          State:
          <b>${esc(s.state)}</b>
        </div>

        <div>
          Declared:
          <b>${esc(s.declared || '')}</b>

          |

          Computed:
          <b class="${mismatch ? 'qai-mismatch' : ''}">
            ${esc(s.computed || '')}
          </b>

          |

          Format:
          <b>${esc(s.format || '')}</b>
        </div>
      `;

      det.appendChild(sum);
      det.appendChild(inner);
      det.appendChild(makeCornerBadge(num));

      box.appendChild(det);
    });

    S.gam.forEach((g, idx) => {
      const num =
        base +
        idx +
        1;

      const det =
        document.createElement('details');

      det.className =
        'qai-det';

      const sum =
        document.createElement('summary');

      sum.className =
        'qai-sum';

      sum.innerHTML = `
        #${num}
        [GAM]
        ${esc(g.adUnitPath || '-')}

        &nbsp;

        ${hbBadgeHTML(g.hb)}

        &nbsp;

        <button
          data-kind="gam"
          data-el="${esc(g.slotElementId)}"
          class="qai-hl"
        >
          Highlight
        </button>
      `;

      const inner =
        document.createElement('div');

      inner.style =
        'margin-top:6px;font-size:11px;white-space:pre-wrap';

      const tgt =
        makeTargetingText(
          g.targeting,
          50
        );

      const hbKeys =
        g.hb?.keys?.length
          ? g.hb.keys
              .map(k => {
                const values =
                  g.targeting?.[k] || [];

                return `${k} = ${values.join('|')}`;
              })
              .join('\n')
          : '(none)';

      const hbEngine =
        g.hb?.engines?.length
          ? g.hb.engines.join(' + ')
          : 'none';

      inner.innerHTML = `
        <div>
          SlotElementId:
          <b>${esc(g.slotElementId || '')}</b>
        </div>

        <div>
          Sizes:
          <b>${esc(g.sizesStr || '')}</b>
        </div>

        <div style="margin-top:5px">
          HB:
          ${
            g.hb?.active
              ? '<b style="color:#176b2c">YES ✓</b>'
              : '<b style="color:#a31d1d">NO ✕</b>'
          }
        </div>

        <div>
          HB engine:
          <b>${esc(hbEngine)}</b>
        </div>

        <div style="margin-top:4px">
          <u>HB targeting</u>:
${esc(hbKeys)}
        </div>

        <div style="margin-top:6px">
          <u>All targeting</u>:
${esc(tgt || '(none)')}
        </div>
      `;

      det.appendChild(sum);
      det.appendChild(inner);
      det.appendChild(makeCornerBadge(num));

      box.appendChild(det);
    });

    attachHighlightHandlers(box);
  }

  // =========================================================
  // HIGHLIGHT
  // =========================================================

  function attachHighlightHandlers(root) {
    root
      .querySelectorAll('.qai-hl')
      .forEach(btn => {
        btn.onclick = e => {
          e.preventDefault();
          e.stopPropagation();

          const kind =
            btn.getAttribute('data-kind');

          const elId =
            btn.getAttribute('data-el');

          let el =
            elId
              ? document.getElementById(elId)
              : null;

          if (!el && kind === 'adsense') {
            const idx =
              parseInt(
                btn.getAttribute('data-idx') || '-1',
                10
              );

            const list =
              document.querySelectorAll(
                'ins.adsbygoogle'
              );

            if (
              idx >= 0 &&
              list[idx]
            ) {
              el =
                list[idx];
            }
          }

          if (!el) {
            return;
          }

          collapse();

          setTimeout(() => {
            el.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });

            const oldOutline =
              el.style.outline;

            const oldOutlineOffset =
              el.style.outlineOffset;

            el.style.outline =
              '3px solid #8a2be2';

            el.style.outlineOffset =
              '2px';

            setTimeout(() => {
              el.style.outline =
                oldOutline;

              el.style.outlineOffset =
                oldOutlineOffset;
            }, 1800);
          }, 100);
        };
      });
  }

  // =========================================================
  // OVERLAYS
  // =========================================================

  function placeBadgesAndOverlays() {
    document
      .querySelectorAll('.qai-slot-badge')
      .forEach(n => n.remove());

    document
      .querySelectorAll('.qai-slot-overlay')
      .forEach(n => n.remove());

    const A =
      visibleAdsense();

    A.forEach((s, i) => {
      const num =
        i + 1;

      const el =
        document.getElementById(
          s.elementId
        );

      if (!el) {
        return;
      }

      addBadge(
        el,
        num
      );

      const lines = [
        `[AdSense] ${s.client || '-'} / ${s.slot || '-'}`,
        `Declared: ${s.declared || '-'} | Computed: ${s.computed || '-'}`
      ];

      addSlotOverlay(
        el,
        num,
        lines
      );
    });

    S.gam.forEach((g, idx) => {
      const num =
        A.length +
        idx +
        1;

      if (!g.slotElementId) {
        return;
      }

      const el =
        document.getElementById(
          g.slotElementId
        );

      if (!el) {
        return;
      }

      addBadge(
        el,
        num
      );

      const hbText =
        g.hb?.active
          ? `HB: YES (${g.hb.engines.join(' + ') || 'detected'})`
          : 'HB: NO';

      const lines = [
        `[GAM] ${g.adUnitPath || '-'}`,
        `Sizes: ${g.sizesStr || '-'}`,
        hbText
      ];

      addSlotOverlay(
        el,
        num,
        lines
      );
    });
  }

  // =========================================================
  // RENDER
  // =========================================================

  function renderAll() {
    if (S.collapsed) {
      return;
    }

    renderHead();
    renderTables();
    renderPanels();
    placeBadgesAndOverlays();
    fitPanelToViewport();

    requestAnimationFrame(() => {
      resetPanelScroll();

      requestAnimationFrame(() => {
        resetPanelScroll();
      });
    });
  }

  // =========================================================
  // COLLAPSE / EXPAND
  // =========================================================

  function collapse() {
    S.collapsed = true;

    panel.style.setProperty(
      'display',
      'none',
      'important'
    );

    icon.style.setProperty(
      'display',
      'flex',
      'important'
    );
  }

  function expand() {
    S.collapsed = false;

    icon.style.setProperty(
      'display',
      'none',
      'important'
    );

    panel.style.setProperty(
      'display',
      'block',
      'important'
    );

    panel.style.setProperty(
      'visibility',
      'visible',
      'important'
    );

    panel.style.setProperty(
      'opacity',
      '1',
      'important'
    );

    rescan();
    renderAll();
  }

  // =========================================================
  // BUTTONS
  // =========================================================

  document.getElementById('qai-r').onclick = () => {
    rescan();
    renderAll();
  };

  document.getElementById('qai-ph').onclick = () => {
    S.showPH =
      !S.showPH;

    renderAll();
  };

  document.getElementById('qai-min').onclick =
    collapse;

  document.getElementById('qai-title').ondblclick =
    collapse;

  icon.onclick =
    expand;

  // =========================================================
  // INIT
  // =========================================================

  function init() {
    S.collapsed = false;

    try {
      localStorage.removeItem(
        '__qai_collapsed'
      );
    } catch {}

    icon.style.setProperty(
      'display',
      'none',
      'important'
    );

    panel.style.setProperty(
      'display',
      'block',
      'important'
    );

    panel.style.setProperty(
      'visibility',
      'visible',
      'important'
    );

    panel.style.setProperty(
      'opacity',
      '1',
      'important'
    );

    fitPanelToViewport();

    rescan();
    renderAll();

    const rerenderForViewport = () => {
      if (S.collapsed) {
        return;
      }

      fitPanelToViewport();
      renderTables();
      renderPanels();

      requestAnimationFrame(
        resetPanelScroll
      );
    };

    window.addEventListener(
      'resize',
      rerenderForViewport
    );

    window.addEventListener(
      'orientationchange',
      () => {
        setTimeout(
          rerenderForViewport,
          150
        );

        setTimeout(
          rerenderForViewport,
          600
        );
      }
    );

    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        'resize',
        rerenderForViewport
      );

      window.visualViewport.addEventListener(
        'scroll',
        () => {
          fitPanelToViewport();
        }
      );
    }

    window.addEventListener(
      'load',
      () => {
        setTimeout(() => {
          rescan();
          renderAll();
        }, 400);

        setTimeout(() => {
          rescan();
          renderAll();
        }, 1500);

        setTimeout(() => {
          rescan();
          renderAll();
        }, 3000);
      }
    );

    setTimeout(() => {
      rescan();
      renderAll();
    }, 500);

    setTimeout(() => {
      rescan();
      renderAll();
    }, 1500);

    setTimeout(() => {
      rescan();
      renderAll();
    }, 3000);
  }

  init();
})();
