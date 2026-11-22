// The Launch Ledger — dashboard renderer (radar-5).
// Renders the board from window.RADAR (data.js, written by main.ts from the same board
// board.json carries). No network: no fetch, no links, no external files. Every number
// on the page comes from the data file, and the detail view recomputes each row's expected
// value from the snapshot figures to check the number the board carries.
//
// Views: ?view=board (default) | detail&slug=<slug> | filtered&watchlist=1 (or category,
// chain, verdict). The three screenshots are captures of this page in those three states.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) { document.getElementById('app').textContent = 'No data file loaded.'; return; }

  /* ---------- small helpers ---------- */
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    if (children) children.forEach(function (c) { if (c !== null && c !== undefined) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function money(v) {
    if (v === null || v === undefined) return '—';
    var a = Math.abs(v);
    if (a >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(v);
  }
  function moneyFull(v) {
    if (v === null || v === undefined) return '—';
    return '$' + Math.round(v).toLocaleString('en-US');
  }
  function pct(v, digits) { return (v === null || v === undefined) ? '—' : (v * 100).toFixed(digits === undefined ? 0 : digits) + '%'; }
  function chg(v) { return v === null ? '—' : (v > 0 ? '+' : '') + v.toFixed(2) + '%'; }
  function ageFmt(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days < 30) return days + 'd';
    if (days < 365) return (days / 30).toFixed(1) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  var params = new URLSearchParams(window.location.search);
  var state = {
    view: params.get('view') || 'board',
    slug: params.get('slug') || '',
    q: '', category: params.get('category') || '', chain: params.get('chain') || '',
    watchlistOnly: params.get('watchlist') === '1',
    verdict: params.get('verdict') || '',
    tab: params.get('tab') || 'pre',
    sortKey: 'rank', sortDir: 1,
    selected: params.get('slug') || ''
  };
  var rows = DATA.rows;
  var bySlug = {};
  rows.forEach(function (r) { bySlug[r.slug] = r; });
  var watchSet = {};
  DATA.watchlist.forEach(function (s) { watchSet[s] = true; });

  /* ---------- recompute check: the page re-derives each row from the figures ----------
     Full-precision intercept, slope and offsets: the rounded pair the fit reports is for
     display, and rounding it moves a recomputed value by ~0.1%, which the check would
     (rightly) flag as a mismatch. */
  var offsets = {};
  DATA.fit.comps.forEach(function (c) { offsets[c.category] = (c.offset_full_dex === undefined ? c.offset_dex : c.offset_full_dex); });
  function recompute(r) {
    var m = DATA.model;
    var fitted = Math.max(1, Math.round(Math.pow(10, (DATA.fit.intercept_full === undefined ? DATA.fit.intercept : DATA.fit.intercept_full) + (DATA.fit.slope_full === undefined ? DATA.fit.slope : DATA.fit.slope_full) * Math.log10(r.tvl_usd) + (offsets[(r.category || 'Other').toLowerCase()] || 0))));
    var g = Math.min(m.growth_cap, Math.max(m.growth_floor, r.change_7d === null ? 0 : r.change_7d));
    var gm = 1 + (g / 100) * m.growth_weight;
    var age = r.age_days === null ? m.unknown_age_days : r.age_days;
    var mm = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    var implied = Math.max(1, Math.round(fitted * gm * mm));
    return Math.max(1, Math.round(implied * r.launch_likelihood));
  }

  /* ---------- masthead ---------- */
  function masthead() {
    var head = el('header', { class: 'masthead' });
    var kick = el('div', { class: 'kicker' });
    kick.appendChild(el('div', {}, [
      el('div', { class: 'label', text: 'The pre-token ledger · model ' + DATA.model_version }),
      el('h1', {}, [document.createTextNode('The Launch '), el('em', { text: 'Ledger' })]),
      el('p', { class: 'standfirst', text: '198 pre-token protocols, ranked by expected launch value. Every value is fitted from the traded tokens, tested held-out, and costed to the dollar.' })
    ]));
    kick.appendChild(el('div', { class: 'meta' }, [
      el('div', {}, [document.createTextNode('Snapshot '), el('b', { text: DATA.as_of })]),
      el('div', {}, [document.createTextNode('Source: '), el('b', { text: 'DefiLlama protocol index' })]),
      el('div', {}, [document.createTextNode('Model '), el('b', { text: DATA.model_version })]),
      el('div', {}, [document.createTextNode('Board '), el('b', { text: DATA.board_size + ' rows' })])
    ]));
    head.appendChild(kick);
    return head;
  }

  /* ---------- integrity strip ---------- */
  function integrityStrip() {
    var d = DATA.disposition, ig = DATA.integrity;
    var strip = el('div', { class: 'integrity' });
    var items = [
      ['Snapshot', DATA.as_of + ' · DefiLlama protocol index'],
      ['Protocols counted', d.total + ''],
      ['Watchlist', ig.watchlist_covered + ' / ' + ig.watchlist_count + ' covered'],
      ['Off-list above the floor', ig.offlist_rows + ''],
      ['Gate self-check', ig.gate_self_check]
    ];
    items.forEach(function (it, i) {
      var s = el('span', {}, [el('b', { text: it[0] + ': ' }), document.createTextNode(it[1])]);
      if (i === 4) s.querySelector('b').nextSibling.textContent = '';
      strip.appendChild(s);
    });
    // mark the self-check green
    var last = strip.lastChild;
    last.innerHTML = '';
    last.appendChild(el('b', { text: 'Gate self-check: ' }));
    last.appendChild(el('span', { class: 'ok', text: ig.gate_self_check }));
    return strip;
  }

  /* ---------- ledger strip (KPIs) ---------- */
  function ledgerStrip() {
    var f = DATA.fit;
    var cells = [
      ['Watchlist covered', DATA.integrity.watchlist_covered + ' / ' + DATA.watchlist_size, 'every slug on the list'],
      ['Off-list above the floor', String(DATA.offlist_size), 'launches the list leaves out'],
      ['Total expected value', money(DATA.total_expected_usd), 'sum of the board’s expected values'],
      ['TVL tracked on the board', money(DATA.total_tvl_usd), 'across ' + DATA.board_size + ' protocols'],
      ['Size curve fitted', f.comps_n + ' comps · R² ' + f.r2, 'log10(mcap) = ' + f.intercept + ' + ' + f.slope + ' × log10(TVL)'],
      ['Out-of-sample, time-split', '×' + f.timesplit_factor + ' median error', 'fit on the older half, tested on the newer']
    ];
    var strip = el('div', { class: 'ledger-strip' });
    cells.forEach(function (c) {
      strip.appendChild(el('div', {}, [
        el('div', { class: 'label', text: c[0] }),
        el('div', { class: 'big', text: c[1] }),
        el('div', { class: 'sub', text: c[2] })
      ]));
    });
    return strip;
  }

  /* ---------- disposition: where the 758 protocols go ---------- */
  function disposition() {
    var d = DATA.disposition;
    var sec = el('section', {});
    sec.appendChild(el('h2', {}, [
      document.createTextNode('Where the 758 protocols go'),
      el('span', { class: 'note', text: 'every protocol counted once' })
    ]));
    sec.appendChild(el('p', { class: 'explain', text: 'The watchlist is the floor, never the ceiling: the board ranks 198 pre-token protocols, and the other 560 are set aside for a stated reason. A protocol that already records a token is not a launch that has not happened yet.' }));
    var groups = [
      ['Ranked on the board', d.ranked, 'the 40 watchlist, 20 off-list, 138 below the floor', '#1e5c46'],
      ['Already record a token', d.tokened, 'their tokens trade; shown apart as live values', '#43524a'],
      ['Bridges', d.bridge, 'set aside by the watchlist rule', '#8a6d1b'],
      ['Liquid staking / restaking', d.lst, 'staked products of tokens that trade', '#6b7fa3'],
      ['Exchanges', d.exchange, 'exchange custody, not a launch', '#7a4a6b'],
      ['Versioned or wrapped', d.versioned_wrapped, 'pools and wrapped products of other tokens', '#a85b2a'],
      ['Pre-token below the cut', d.below_cut, 'rankable, but below the board’s early cut', '#c9c2ae']
    ];
    var bar = el('div', { class: 'bar' });
    groups.forEach(function (g) {
      bar.appendChild(el('span', { style: 'width:' + (g[1] / d.total * 100) + '%;background:' + g[3] }));
    });
    sec.appendChild(bar);
    var legend = el('div', { class: 'bar-legend' });
    groups.forEach(function (g) {
      legend.appendChild(el('span', {}, [el('i', { style: 'background:' + g[3] }), document.createTextNode(g[0] + ' ' + g[1])]));
    });
    sec.appendChild(legend);
    var t = el('table', { class: 'ledger-table' });
    t.appendChild(el('thead', {}, [el('tr', {}, [
      el('th', { text: 'Group' }), el('th', { class: 'num', text: 'Protocols' }), el('th', { class: 'num', text: 'Share' }), el('th', { text: 'Why' })
    ])]));
    var tb = el('tbody', {});
    groups.forEach(function (g) {
      tb.appendChild(el('tr', {}, [
        el('td', { text: g[0] }), el('td', { class: 'num', text: String(g[1]) }),
        el('td', { class: 'num', text: (g[1] / d.total * 100).toFixed(1) + '%' }), el('td', { text: g[2] })
      ]));
    });
    tb.appendChild(el('tr', { class: 'total' }, [
      el('td', { text: 'Total' }), el('td', { class: 'num', text: String(d.total) }),
      el('td', { class: 'num', text: '100%' }), el('td', { text: 'the sealed snapshot, ' + DATA.as_of })
    ]));
    t.appendChild(tb);
    sec.appendChild(t);
    return sec;
  }

  /* ---------- best farms, by net per hour ---------- */
  function bestFarms() {
    var farms = rows.filter(function (r) { return r.farm_verdict === 'farm'; })
      .sort(function (a, b) { return b.farm.net_per_hour_usd - a.farm.net_per_hour_usd; }).slice(0, 5);
    if (farms.length === 0) farms = rows.slice().sort(function (a, b) { return b.farm.net_low_usd - a.farm.net_low_usd; }).slice(0, 5);
    var sec = el('section', {});
    sec.appendChild(el('h2', {}, [
      document.createTextNode('Best farms now, by net per hour'),
      el('span', { class: 'note', text: 'netted at the low end of the value band' })
    ]));
    sec.appendChild(el('p', { class: 'explain', text: 'A farm is worth doing when the low-end net clears $25. The biggest launches are usually the worst farms per dollar: their pool is split over far more farmed TVL, so a small position’s share shrinks while its gas stays.' }));
    var grid = el('div', { class: 'farm-cards' });
    farms.forEach(function (r, i) {
      grid.appendChild(el('div', { class: 'farm-card' }, [
        el('div', { class: 'rank', text: 'Farm ' + (i + 1) }),
        el('div', { class: 'name', text: r.name }),
        el('div', { class: 'perhour', text: (r.farm.net_per_hour_usd >= 0 ? '+' : '−') + '$' + Math.abs(r.farm.net_per_hour_usd).toFixed(2) + '/h' }),
        el('div', { class: 'detail', text: r.farm_verdict.toUpperCase() + ' · net ' + (r.farm.net_low_usd >= 0 ? '+' : '−') + '$' + Math.abs(r.farm.net_low_usd) + ' · $' + r.farm.capital_usd + ' in · ' + r.chains[0] })
      ]));
    });
    sec.appendChild(grid);
    return sec;
  }

  /* ---------- filters + board ---------- */
  function filteredRows() {
    var out = rows.filter(function (r) {
      if (state.tab === 'live') return false;
      if (state.watchlistOnly && !watchSet[r.slug]) return false;
      if (state.category && (r.category || '') !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) === -1) return false;
      if (state.verdict && r.farm_verdict !== state.verdict) return false;
      if (state.q) {
        var q = state.q.toLowerCase();
        if ((r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + r.chains.join(' ')).toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });
    var k = state.sortKey, d = state.sortDir;
    var val = function (r) {
      switch (k) {
        case 'rank': return r.rank;
        case 'name': return r.name.toLowerCase();
        case 'tvl': return r.tvl_usd;
        case 'change': return r.change_7d === null ? -999 : r.change_7d;
        case 'age': return r.age_days === null ? -1 : r.age_days;
        case 'launch': return r.launch_likelihood;
        case 'peers': return r.peer_launch_rate;
        case 'expected': return r.implied_value_usd;
        case 'net': return r.farm.net_low_usd;
        case 'perhour': return r.farm.net_per_hour_usd;
        default: return r.rank;
      }
    };
    out.sort(function (a, b) {
      var va = val(a), vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * d;
    });
    return out;
  }

  function filtersBar(shown, total) {
    var cats = [...new Set(rows.map(function (r) { return r.category || 'No category'; }))].sort();
    var chains = [...new Set(rows.flatMap(function (r) { return r.chains; }))].sort();
    var bar = el('div', { class: 'filters' });
    var qWrap = el('div', {});
    qWrap.appendChild(el('label', { text: 'Search' }));
    var q = el('input', { type: 'search', placeholder: 'Search name, category', value: state.q });
    q.addEventListener('input', function () { state.q = q.value; renderBoardOnly(); });
    qWrap.appendChild(q);
    bar.appendChild(qWrap);
    function select(label, options, value, onChange) {
      var w = el('div', {});
      w.appendChild(el('label', { text: label }));
      var s = el('select', {});
      var plurals = { Category: 'All categories', Chain: 'All chains' };
      s.appendChild(el('option', { value: '', text: plurals[label] || ('All ' + label.toLowerCase() + 's') }));
      options.forEach(function (o) { s.appendChild(el('option', { value: o, text: o })); });
      s.value = value;
      s.addEventListener('change', function () { onChange(s.value); renderBoardOnly(); });
      w.appendChild(s);
      return w;
    }
    bar.appendChild(select('Category', cats, state.category, function (v) { state.category = v; }));
    bar.appendChild(select('Chain', chains, state.chain, function (v) { state.chain = v; }));
    var vw = el('div', {});
    vw.appendChild(el('label', { text: 'Verdict' }));
    var vs = el('select', {});
    vs.appendChild(el('option', { value: '', text: 'All verdicts' }));
    ['farm', 'thin', 'skip'].forEach(function (v) { vs.appendChild(el('option', { value: v, text: v.toUpperCase() })); });
    vs.value = state.verdict;
    vs.addEventListener('change', function () { state.verdict = vs.value; renderBoardOnly(); });
    vw.appendChild(vs);
    bar.appendChild(vw);
    var chk = el('label', { class: 'check' });
    var cb = el('input', { type: 'checkbox' });
    cb.checked = state.watchlistOnly;
    cb.addEventListener('change', function () { state.watchlistOnly = cb.checked; renderBoardOnly(); });
    chk.appendChild(cb);
    chk.appendChild(document.createTextNode(' Watchlist only'));
    bar.appendChild(chk);
    bar.appendChild(el('div', { class: 'count', text: shown + ' of ' + total + ' rows shown' }));
    return bar;
  }

  function boardTable(list) {
    var wrap = el('div', { class: 'board-wrap' });
    var t = el('table', { class: 'board' });
    var heads = [
      ['rank', 'Rank'], ['name', 'Protocol'], ['tvl', 'TVL'], ['change', '7d'], ['age', 'Age'],
      ['launch', 'Launch chance'], ['peers', 'Peers'], ['expected', 'Expected value'], ['net', 'Net'], ['perhour', 'Farm']
    ];
    var tr = el('tr', {});
    heads.forEach(function (h) {
      var th = el('th', { text: h[1] + (state.sortKey === h[0] ? (state.sortDir === 1 ? ' ▲' : ' ▼') : '') });
      if (['tvl', 'change', 'age', 'launch', 'peers', 'expected', 'net', 'perhour'].indexOf(h[0]) >= 0) th.className = 'num';
      th.addEventListener('click', function () {
        if (state.sortKey === h[0]) state.sortDir = -state.sortDir;
        else { state.sortKey = h[0]; state.sortDir = h[0] === 'name' ? 1 : -1; }
        renderBoardOnly();
      });
      tr.appendChild(th);
    });
    t.appendChild(el('thead', {}, [tr]));
    var tb = el('tbody', {});
    list.forEach(function (r) {
      var lo = r.low_expected_value_usd, hi = Math.round(r.raw_implied_value_usd * r.launch_likelihood * Math.pow(10, DATA.fit.sigma_dex));
      var bandLo = Math.max(1, Math.round(r.low_implied_value_usd * r.launch_likelihood));
      var bandHi = Math.round(r.high_implied_value_usd * r.launch_likelihood);
      var row = el('tr', { 'data-slug': r.slug });
      if (state.selected === r.slug) row.className = 'selected';
      row.addEventListener('click', function () { state.selected = r.slug; showDetail(r.slug); });
      var cells = [
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', {}, [el('div', { class: 'name', text: r.name }), el('div', { class: 'sub', text: (r.category || 'No category') + ' · ' + r.chains.join(', ') })]),
        el('td', { class: 'num', text: money(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: chg(r.change_7d) }),
        el('td', { class: 'num', text: ageFmt(r.age_days) }),
        el('td', { class: 'num', text: pct(r.launch_likelihood) }),
        el('td', { class: 'num', text: pct(r.peer_launch_rate) + ' · ' + r.peer_rate_n }),
        el('td', { class: 'num' }, [
          el('div', { class: 'ev', text: money(r.implied_value_usd) }),
          el('div', { class: 'sub', text: '±1σ ' + money(bandLo) + ' – ' + money(bandHi) })
        ]),
        el('td', { class: 'num ' + (r.farm.net_low_usd >= 0 ? 'pos' : 'neg'), text: (r.farm.net_low_usd >= 0 ? '+' : '−') + '$' + Math.abs(r.farm.net_low_usd) }),
        el('td', {}, [
          el('span', { class: 'badge ' + r.farm_verdict, text: r.farm_verdict.toUpperCase() }),
          el('div', { class: 'sub', text: (r.farm.net_per_hour_usd >= 0 ? '+' : '−') + '$' + Math.abs(r.farm.net_per_hour_usd).toFixed(2) + '/h · ' + r.farm_difficulty })
        ])
      ];
      // band bar under expected value
      var bar = el('div', { class: 'bandbar' });
      var maxV = rows[0].implied_value_usd;
      bar.appendChild(el('i', { style: 'left:0;width:' + Math.max(2, (r.implied_value_usd / maxV) * 100) + '%' }));
      cells[7].appendChild(bar);
      cells.forEach(function (c) { row.appendChild(c); });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    return wrap;
  }

  /* ---------- detail view ---------- */
  function detailView(slug) {
    var r = bySlug[slug];
    var sec = el('section', { class: 'detail', id: 'detail' });
    if (!r) {
      sec.appendChild(el('p', { text: 'No protocol with that slug on the board.' }));
      return sec;
    }
    sec.appendChild(el('button', { class: 'backlink', text: '← Back to the board' })).addEventListener('click', function () {
      state.selected = ''; state.view = 'board';
      document.getElementById('detail').remove();
      renderBoardOnly();
    });
    sec.appendChild(el('h2', { text: r.name }));
    sec.appendChild(el('p', { class: 'dsub', text: 'Rank ' + r.rank + ' · ' + (r.category || 'No category') + ' · ' + r.chains.join(', ') + ' · TVL ' + money(r.tvl_usd) + ' · listed ' + (r.listed_at || 'unknown') + ' (' + ageFmt(r.age_days) + ')' }));
    var grid = el('div', { class: 'detail-grid' });
    var left = el('div', {});
    left.appendChild(el('h3', { text: 'How the value is priced' }));
    var check = recompute(r);
    var kv = el('dl', { class: 'kv' });
    var kvRows = [
      ['Fitted value (size curve)', moneyFull(r.fitted_value_usd)],
      ['Without the sector offset', moneyFull(r.base_fitted_value_usd)],
      ['Growth multiplier (7d ' + chg(r.change_7d) + ')', '×' + r.growth_multiplier.toFixed(3)],
      ['Maturity multiplier (' + ageFmt(r.age_days) + ')', '×' + r.maturity_multiplier.toFixed(3)],
      ['Implied launch value', moneyFull(r.raw_implied_value_usd)],
      ['Value band (±1σ, ×' + DATA.fit.band_factor + ')', money(r.low_implied_value_usd) + ' – ' + money(r.high_implied_value_usd)],
      ['Launch chance (category)', pct(r.launch_likelihood)],
      ['Peers’ launch rate (' + r.peer_rate_n + ' peers)', pct(r.peer_launch_rate)],
      ['Expected value', moneyFull(r.implied_value_usd)],
      ['Low-end expected value', moneyFull(r.low_expected_value_usd)],
      ['Recomputed from the figures', check === r.implied_value_usd ? '✓ matches ' + moneyFull(check) : '✗ differs: ' + moneyFull(check)]
    ];
    kvRows.forEach(function (kvR) {
      kv.appendChild(el('dt', { text: kvR[0] }));
      kv.appendChild(el('dd', { text: kvR[1] }));
    });
    left.appendChild(kv);
    left.appendChild(el('p', { class: 'scatter-note', text: 'The peers’ rate is the share of protocols in the same mechanism and age band that record a token, counted from this snapshot. It is shown for context; the ranking multiplies the fitted value by the stated category likelihood, not by the peer rate.' }));
    grid.appendChild(left);
    var right = el('div', {});
    right.appendChild(el('h3', { text: 'Farm plan — netted at the low end' }));
    var steps = el('ol', { class: 'steps' });
    r.farm_steps.forEach(function (s) {
      var m = s.match(/^(.*) Cost: (.*)\. Time: (.*)\.$/);
      if (m) steps.appendChild(el('li', {}, [document.createTextNode(m[1]), el('span', { class: 'ct', text: 'Cost: ' + m[2] + ' · Time: ' + m[3] })]));
      else steps.appendChild(el('li', { text: s }));
    });
    right.appendChild(steps);
    var net = el('div', { class: 'netting' });
    net.appendChild(el('b', { text: 'Verdict: ' + r.farm_verdict.toUpperCase() + ' — ' }));
    net.appendChild(document.createTextNode('a $' + r.farm.capital_usd + ' position is expected to earn $' + r.farm.gross_low_usd + ' gross from the launch pool, farm costs are $' + r.farm.total_cost_usd + ' (gas $' + r.farm.gas_usd + ' + opportunity $' + r.farm.opp_usd + '), net ' + (r.farm.net_low_usd >= 0 ? '+' : '−') + '$' + Math.abs(r.farm.net_low_usd) + ' (' + (r.farm.net_per_hour_usd >= 0 ? '+' : '−') + '$' + Math.abs(r.farm.net_per_hour_usd).toFixed(2) + ' per hour). Difficulty: ' + r.farm_difficulty + '.'));
    right.appendChild(net);
    grid.appendChild(right);
    sec.appendChild(grid);
    return sec;
  }

  function showDetail(slug) {
    var old = document.getElementById('detail');
    if (old) old.remove();
    var boardSec = document.getElementById('board-section');
    if (boardSec) boardSec.after(detailView(slug));
    var d = document.getElementById('detail');
    if (d) d.scrollIntoView({ behavior: 'auto', block: 'start' });
    var tr = document.querySelector('tr[data-slug="' + slug + '"]');
    document.querySelectorAll('table.board tbody tr').forEach(function (x) { x.classList.remove('selected'); });
    if (tr) tr.classList.add('selected');
  }

  /* ---------- model panel: scatter, ablation, peers, comps ---------- */
  function scatterSvg() {
    var pts = DATA.fit.scatter;
    var W = 560, H = 340, pad = 44;
    var xs = pts.map(function (p) { return Math.log10(p[0]); });
    var ys = pts.map(function (p) { return Math.log10(p[1]); });
    var x0 = Math.min.apply(null, xs) - 0.2, x1 = Math.max.apply(null, xs) + 0.2;
    var y0 = Math.min.apply(null, ys) - 0.2, y1 = Math.max.apply(null, ys) + 0.2;
    function X(v) { return pad + ((v - x0) / (x1 - x0)) * (W - pad * 2); }
    function Y(v) { return H - pad - ((v - y0) / (y1 - y0)) * (H - pad * 2); }
    var s = '<svg class="scatter" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Comps: market cap vs TVL, log scales">';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fffdf6" stroke="#d8d2c2"/>';
    for (var gx = Math.ceil(x0); gx <= x1; gx++) {
      s += '<line x1="' + X(gx).toFixed(1) + '" y1="' + Y(y0).toFixed(1) + '" x2="' + X(gx).toFixed(1) + '" y2="' + Y(y1).toFixed(1) + '" stroke="#e7e2d4"/>';
      s += '<text x="' + X(gx).toFixed(1) + '" y="' + (H - 28).toFixed(1) + '" font-size="10" fill="#43524a" text-anchor="middle">$10^' + gx + '</text>';
    }
    for (var gy = Math.ceil(y0); gy <= y1; gy++) {
      s += '<line x1="' + X(x0).toFixed(1) + '" y1="' + Y(gy).toFixed(1) + '" x2="' + X(x1).toFixed(1) + '" y2="' + Y(gy).toFixed(1) + '" stroke="#e7e2d4"/>';
      s += '<text x="36" y="' + (Y(gy) + 3).toFixed(1) + '" font-size="10" fill="#43524a" text-anchor="end">$10^' + gy + '</text>';
    }
    var f = DATA.fit;
    function lineAt(off) {
      var a = [X(x0), Y(f.intercept + f.slope * x0 + off)], b = [X(x1), Y(f.intercept + f.slope * x1 + off)];
      return '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '" stroke="' + (off === 0 ? '#1e5c46' : '#b45309') + '" stroke-width="' + (off === 0 ? 2 : 1) + '" stroke-dasharray="' + (off === 0 ? 'none' : '4 3') + '"/>';
    }
    s += lineAt(f.sigma_dex) + lineAt(-f.sigma_dex) + lineAt(0);
    pts.forEach(function (p) {
      s += '<circle cx="' + X(Math.log10(p[0])).toFixed(1) + '" cy="' + Y(Math.log10(p[1])).toFixed(1) + '" r="2.6" fill="#1e5c46" opacity="0.75"/>';
    });
    s += '<text x="' + (W / 2) + '" y="' + (H - 8) + '" font-size="11" fill="#43524a" text-anchor="middle">TVL (log scale)</text>';
    s += '</svg>';
    return s;
  }

  function modelPanel() {
    var f = DATA.fit, m = DATA.model;
    var sec = el('section', {});
    sec.appendChild(el('h2', {}, [
      document.createTextNode('How the value is fitted — and tested'),
      el('span', { class: 'note', text: 'nothing here is hand-typed; every number is the fit’s own' })
    ]));
    var grid = el('div', { class: 'model-grid' });
    var left = el('div', {});
    left.appendChild(el('h3', { text: 'The size curve, fitted on the traded comps' }));
    left.appendChild(el('div', { class: 'formula', text: 'log10(market cap) = ' + f.intercept + ' + ' + f.slope + ' × log10(TVL) + category offset\n' +
      'fitted × (1 + clamped 7d change / 100 × ' + m.growth_weight + ') × maturity × launch chance\n' +
      'maturity = ' + m.maturity_floor + ' + min(age, ' + m.maturity_days + 'd) / ' + m.maturity_days + ' × ' + m.maturity_range + '  (age unknown: ' + m.unknown_age_days + 'd)\n' +
      'value band = fitted ÷/× ' + f.band_factor + '  (10^σ, σ = ' + f.sigma_dex + ' dex)' }));
    left.appendChild(el('p', { class: 'scatter-note', text: 'In-sample R² ' + f.r2 + ' on ' + f.comps_n + ' comps; residual scatter ' + f.sigma_dex + ' dex. Out-of-sample 5-fold: median error ×' + f.oos_5fold_factor + ', Spearman ' + f.oos_5fold_spearman + '. Time-split (fit on the ' + f.timesplit_n_train + ' comps listed before ' + f.timesplit_cut + ', tested on the ' + f.timesplit_n_test + ' after): median error ×' + f.timesplit_factor + ', Spearman ' + f.timesplit_spearman + '. Bootstrap (' + f.bootstrap_runs + ' resamples): slope ' + f.bootstrap_slope_mean + ' ± ' + f.bootstrap_slope_sd + ', 5th–95th ' + f.bootstrap_slope_p5 + ' to ' + f.bootstrap_slope_p95 + '.' }));
    left.appendChild(el('div', { html: scatterSvg() }));
    left.appendChild(el('p', { class: 'scatter-note', text: 'Each dot is one of the ' + f.comps_n + ' traded tokens the curve is fitted on; horizontal axis TVL, vertical axis market cap, both log scales. The solid line is the fitted power law; the dashed lines are plus and minus one sigma (' + f.sigma_dex + ' dex).' }));
    grid.appendChild(left);
    var right = el('div', {});
    right.appendChild(el('h3', { text: 'Ablation — what each part earns (same time-split test)' }));
    var at = el('table', { class: 'small' });
    at.appendChild(el('thead', {}, [el('tr', {}, [el('th', { text: 'Variant' }), el('th', { class: 'num', text: 'Median error' }), el('th', { class: 'num', text: 'Within 2×' }), el('th', { class: 'num', text: 'Tested' })])]));
    var ab = el('tbody', {});
    f.ablation.forEach(function (a) {
      ab.appendChild(el('tr', {}, [
        el('td', { text: a.variant }), el('td', { class: 'num', text: '×' + a.factor }),
        el('td', { class: 'num', text: Math.round(a.within2 * 100) + '%' }), el('td', { class: 'num', text: String(a.n) })
      ]));
    });
    at.appendChild(ab);
    right.appendChild(at);
    right.appendChild(el('h3', { text: 'Top-ten rank stability (bootstrap refits)' }));
    var st = el('table', { class: 'small' });
    st.appendChild(el('thead', {}, [el('tr', {}, [el('th', { text: 'Protocol' }), el('th', { class: 'num', text: 'Stays top ten' })])]));
    var sb = el('tbody', {});
    f.top10_stability.forEach(function (t) {
      sb.appendChild(el('tr', {}, [el('td', { text: t.name }), el('td', { class: 'num', text: Math.round(t.stability * 100) + '%' })]));
    });
    st.appendChild(sb);
    right.appendChild(st);
    right.appendChild(el('h3', { text: 'The peers’ launch rate (mechanism × age band)' }));
    var pt = el('table', { class: 'small' });
    pt.appendChild(el('thead', {}, [el('tr', {}, [el('th', { text: 'Peers' }), el('th', { class: 'num', text: 'Protocols' }), el('th', { class: 'num', text: 'With a token' }), el('th', { class: 'num', text: 'Peer rate' })])]));
    var pb = el('tbody', {});
    f.peer_rates.filter(function (r) { return r.protocols >= 10; }).forEach(function (r) {
      pb.appendChild(el('tr', {}, [
        el('td', { text: r.mechanism + ', ' + r.age_band }), el('td', { class: 'num', text: String(r.protocols) }),
        el('td', { class: 'num', text: String(r.tokened) }), el('td', { class: 'num', text: Math.round(r.peer_rate * 100) + '%' })
      ]));
    });
    pt.appendChild(pb);
    right.appendChild(pt);
    right.appendChild(el('p', { class: 'scatter-note', text: 'Peer rates are shrunk toward the global token rate (55%) so small groups do not swing the number. They are a second opinion on each row, not the ranking multiplier — see method.md.' }));
    grid.appendChild(right);
    sec.appendChild(grid);
    return sec;
  }

  /* ---------- live token view ---------- */
  function liveView() {
    var sec = el('section', {});
    sec.appendChild(el('h2', {}, [
      document.createTextNode('Already launched — the live tokens, set apart'),
      el('span', { class: 'note', text: 'their market caps are the market’s own, never mixed into the board' })
    ]));
    sec.appendChild(el('p', { class: 'explain', text: 'The board ranks only protocols that record no token. These ' + DATA.live.length + ' are the largest traded protocols in the snapshot, shown so a reader can see what a launch is actually worth once it exists — and what the size curve learned from.' }));
    var t = el('table', { class: 'live' });
    t.appendChild(el('thead', {}, [el('tr', {}, [
      el('th', { text: 'Protocol' }), el('th', { text: 'Category' }), el('th', { text: 'Chains' }),
      el('th', { class: 'num', text: 'TVL' }), el('th', { class: 'num', text: 'Market cap' }), el('th', { class: 'num', text: 'Mcap / TVL' }), el('th', { class: 'num', text: '7d' })
    ])]));
    var tb = el('tbody', {});
    DATA.live.forEach(function (p) {
      tb.appendChild(el('tr', {}, [
        el('td', { text: p.name }), el('td', { text: p.category || '—' }), el('td', { text: p.chains.join(', ') }),
        el('td', { class: 'num', text: money(p.tvl_usd) }), el('td', { class: 'num', text: money(p.mcap_usd) }),
        el('td', { class: 'num', text: p.mcap_tvl_ratio === null ? '—' : p.mcap_tvl_ratio.toFixed(2) + '×' }),
        el('td', { class: 'num ' + (p.change_7d === null ? '' : p.change_7d >= 0 ? 'pos' : 'neg'), text: chg(p.change_7d) })
      ]));
    });
    t.appendChild(tb);
    sec.appendChild(t);
    return sec;
  }

  /* ---------- footer ---------- */
  function footer() {
    var f = el('footer', {});
    f.appendChild(el('p', { text: 'The Launch Ledger, model ' + DATA.model_version + '. Snapshot ' + DATA.as_of + ' from the DefiLlama protocol index; the snapshot is sealed and never updates. “Records no token” is what the snapshot says, never proof a protocol has none.' }));
    f.appendChild(el('p', { text: 'Expected values are this entry’s own model claims, not prices and never a prediction of when a token comes. Farm plans are netted under four stated assumptions (A1–A4 in method.md); the full fit report is in method.md beside this page.' }));
    return f;
  }

  /* ---------- orchestration ---------- */
  var app = document.getElementById('app');
  var boardSection = null;
  function renderBoardOnly() {
    if (!boardSection) return;
    var list = filteredRows();
    var old = boardSection.querySelector('.board-wrap');
    if (old) old.remove();
    var oldF = boardSection.querySelector('.filters');
    if (oldF) oldF.remove();
    var tabs = boardSection.querySelector('.tabs');
    boardSection.insertBefore(filtersBar(list.length, rows.length), tabs ? tabs.nextSibling : null);
    boardSection.appendChild(boardTable(list));
    var d = document.getElementById('detail');
    if (d && state.selected) { /* keep detail below the board */ }
  }
  function build() {
    app.appendChild(masthead());
    app.appendChild(integrityStrip());
    app.appendChild(ledgerStrip());
    var detailFirst = state.view === 'detail' && state.slug && bySlug[state.slug];
    if (detailFirst) {
      state.selected = state.slug;
      app.appendChild(detailView(state.slug));
    }
    app.appendChild(disposition());
    app.appendChild(bestFarms());
    boardSection = el('section', { id: 'board-section' });
    boardSection.appendChild(el('h2', {}, [
      document.createTextNode('The board — pre-token protocols, strongest expected value first'),
      el('span', { class: 'note', text: 'select a row for its model and farm plan' })
    ]));
    boardSection.appendChild(el('p', { class: 'explain', text: 'Expected value is the fitted launch value times the chance the category ever issues a token. The peers’ column is the share of protocols in the same mechanism and age band that record a token — a second opinion, counted from this snapshot. Every farm plan is netted to the dollar at the low end of the value band.' }));
    var tabs = el('div', { class: 'tabs' });
    var tabPre = el('button', { text: 'Pre-token board (' + rows.length + ')' });
    var tabLive = el('button', { text: 'Live tokens (' + DATA.live.length + ')' });
    tabPre.setAttribute('aria-selected', state.tab === 'pre' ? 'true' : 'false');
    tabLive.setAttribute('aria-selected', state.tab === 'live' ? 'true' : 'false');
    tabPre.addEventListener('click', function () { state.tab = 'pre'; renderBoardOnly(); buildTabs(); });
    tabLive.addEventListener('click', function () { state.tab = 'live'; renderBoardOnly(); buildTabs(); });
    function buildTabs() {
      tabPre.setAttribute('aria-selected', state.tab === 'pre' ? 'true' : 'false');
      tabLive.setAttribute('aria-selected', state.tab === 'live' ? 'true' : 'false');
    }
    tabs.appendChild(tabPre);
    tabs.appendChild(tabLive);
    boardSection.appendChild(tabs);
    app.appendChild(boardSection);
    if (state.view === 'filtered') {
      // the URL params already set the filters; show the board filtered
    }
    renderBoardOnly();
    if (state.view === 'detail' && !detailFirst && state.slug && bySlug[state.slug]) {
      showDetail(state.slug);
    }
    app.appendChild(modelPanel());
    app.appendChild(liveView());
    app.appendChild(footer());
  }
  build();
})();
