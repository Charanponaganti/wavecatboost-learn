/* WaveCatBoost learn SPA — static, no backend */
(function () {
  "use strict";

  const COLORS = {
    y: "#1F3A5F",
    yhat: "#A64B2A",
    band: "rgba(166,75,42,0.18)",
    bandLine: "rgba(166,75,42,0.45)",
    D: ["#A64B2A", "#C47A5A", "#8a5a12", "#5B7C99", "#2E6B4F", "#1F3A5F", "#6b4f8a", "#3d6b8a"],
    S: "#1F3A5F",
    energy: "#5B7C99"
  };

  const EDA_FIGS = [
    { src: "assets/diag_2x2_cpcb_pm25.png", cap: "Series · ACF · PACF · seasonal" },
    { src: "assets/acf_pacf_cpcb_pm25.png", cap: "ACF / PACF" },
    { src: "assets/boxes_cpcb_pm25.png", cap: "Hour / DOW boxes → S=24" },
    { src: "assets/lag1_scatter_cpcb_pm25.png", cap: "Lag-1 scatter" },
    { src: "assets/lag24_scatter_cpcb_pm25.png", cap: "Lag-24 scatter" },
    { src: "assets/eda_snaive_resid_acf_cpcb_pm25.png", cap: "snaive residual ACF" },
    { src: "assets/eda_energy_cpcb_pm25.png", cap: "Haar energy shares" },
    { src: "assets/mra_d1d4_s4_cpcb_pm25.png", cap: "MRA D1–D4 · S4" },
    { src: "assets/eda_design_board_cpcb_pm25.png", cap: "Design board" },
    { src: "assets/eda_to_pipeline_cpcb_pm25.png", cap: "EDA → pipeline" }
  ];

  const state = {
    sensor: "CPCB",
    mraTimer: null,
    animTimer: null,
    animStep: 0,
    cbTimer: null
  };

  const plotLayout = (extra) => Object.assign({
    margin: { t: 28, r: 18, b: 40, l: 48 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "#f7f9fb",
    font: { family: "Segoe UI, Helvetica Neue, sans-serif", size: 11, color: "#1a2332" },
    xaxis: { gridcolor: "#e8ecf1", zeroline: false },
    yaxis: { gridcolor: "#e8ecf1", zeroline: false },
    legend: { orientation: "h", y: 1.12 },
    hovermode: "x unified"
  }, extra || {});

  const plotCfg = { responsive: true, displayModeBar: true, displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"] };

  function learn() { return window.LEARN || {}; }
  function scores() { return window.SCORES || []; }
  function datasets() { return (learn().datasets) || {}; }

  function activeSeries() {
    const ds = datasets()[state.sensor];
    if (ds && ds.y && ds.y.length) return ds;
    const keys = Object.keys(datasets());
    if (keys.length) {
      state.sensor = keys[0];
      return datasets()[keys[0]];
    }
    return { sensor: "—", t: [], y: [], n_full: 0 };
  }

  function setSensor(s) {
    if (!datasets()[s]) return;
    state.sensor = s;
    syncSensorUI();
    renderHome();
    renderData();
    renderEdaSeries();
    syncMraSensor();
    renderMra();
  }

  function syncSensorUI() {
    document.querySelectorAll("[data-sensor]").forEach((el) => {
      el.classList.toggle("on", el.getAttribute("data-sensor") === state.sensor);
    });
    const sel = document.getElementById("mraSensor");
    if (sel) sel.value = state.sensor;
  }

  /* ---------- nav ---------- */
  function showPage(name) {
    document.querySelectorAll(".page").forEach((p) => p.classList.toggle("on", p.dataset.page === name));
    document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.page === name));
    if (name === "modwt-live") renderMra();
    if (name === "modwt-math") renderAnim(true);
    if (name === "catboost") renderCatboost();
    if (name === "metrics") renderMetrics();
    if (name === "conformal") renderConformal();
    if (name === "eda") renderEdaSeries();
    if (name === "home") renderHome();
    if (name === "data") renderData();
  }

  /* ---------- home / data ---------- */
  function renderHomeChips() {
    const host = document.getElementById("homeChips");
    if (!host) return;
    host.innerHTML = "";
    Object.keys(datasets()).forEach((k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (k === state.sensor ? " on" : "");
      b.setAttribute("data-sensor", k);
      b.textContent = k + " · PM2.5";
      b.addEventListener("click", () => setSensor(k));
      host.appendChild(b);
    });
  }

  function seriesTrace(ds, name) {
    return {
      x: ds.t, y: ds.y, type: "scatter", mode: "lines",
      name: name || ds.sensor,
      line: { color: COLORS.y, width: 1.2 },
      hovertemplate: "%{x}<br>%{y:.2f}<extra></extra>"
    };
  }

  function renderHome() {
    renderHomeChips();
    const ds = activeSeries();
    if (!window.Plotly) return;
    Plotly.react("homeSeries", [seriesTrace(ds)], plotLayout({
      title: { text: ds.sensor + " PM2.5 · last " + ds.y.length + " h (of " + ds.n_full + ")", font: { size: 13 } },
      yaxis: { title: "µg/m³", gridcolor: "#e8ecf1" }
    }), plotCfg);
  }

  function renderData() {
    const host = document.getElementById("dsCards");
    if (host) {
      host.innerHTML = "";
      Object.keys(datasets()).forEach((k) => {
        const ds = datasets()[k];
        const div = document.createElement("div");
        div.className = "block";
        div.innerHTML = "<h3>" + k + "</h3>" +
          "<p class='muted' style='margin:0 0 10px'>PM2.5 · n=" + ds.n_full + "</p>" +
          "<button type='button' class='btn" + (k === state.sensor ? "" : " secondary") +
          "' data-pick='" + k + "'>" + (k === state.sensor ? "Selected" : "Use") + "</button>";
        host.appendChild(div);
      });
      host.querySelectorAll("[data-pick]").forEach((b) => {
        b.addEventListener("click", () => setSensor(b.getAttribute("data-pick")));
      });
    }
    const ds = activeSeries();
    if (window.Plotly) {
      Plotly.react("dsPlot", [seriesTrace(ds)], plotLayout({
        title: { text: ds.sensor + " · interactive", font: { size: 13 } },
        yaxis: { title: "µg/m³", gridcolor: "#e8ecf1" }
      }), plotCfg);
    }
    const L = learn().links || {};
    const set = (id, href) => { const a = document.getElementById(id); if (a && href) a.href = href; };
    set("linkCpcb", L.cpcb); set("linkCaaqms", L.caaqms); set("linkWho", L.who);
    set("linkCode", L.paper_code); set("paperLink", L.paper);
  }

  /* ---------- EDA ---------- */
  function renderEda() {
    const host = document.getElementById("edaDecisions");
    if (host) {
      const rows = learn().eda_decisions || [];
      host.innerHTML = rows.map((r) => {
        const find = r.EDA_finding || r.eda_finding || "";
        const choice = r.Pipeline_choice || r.pipeline_choice || "";
        return "<div class='decision'><div>" + find + "</div><div class='arrow'>→</div><div><strong>" + choice + "</strong></div></div>";
      }).join("");
    }
    const grid = document.getElementById("edaGrid");
    if (grid) {
      grid.innerHTML = EDA_FIGS.map((f) =>
        "<div class='eda-card'><img src='" + f.src + "' alt='" + f.cap + "' loading='lazy' /><div class='cap'>" + f.cap + "</div></div>"
      ).join("");
      grid.querySelectorAll("img").forEach((img) => {
        img.addEventListener("click", () => {
          document.getElementById("lightboxImg").src = img.src;
          document.getElementById("lightbox").classList.add("on");
        });
      });
    }
  }

  function renderEdaSeries() {
    if (!window.Plotly) return;
    const ds = activeSeries();
    Plotly.react("edaSeries", [seriesTrace(ds)], plotLayout({
      margin: { t: 10, r: 10, b: 30, l: 40 },
      showlegend: false
    }), plotCfg);
  }

  /* ---------- MODWT animation ---------- */
  function animSeries() {
    const ds = activeSeries();
    const n = Math.min(96, ds.y.length);
    return ds.y.slice(ds.y.length - n);
  }

  function renderAnim(reset) {
    if (!window.Plotly || !window.MODWT) return;
    if (reset) state.animStep = 0;
    const Jmax = parseInt(document.getElementById("animJ").value, 10) || 4;
    let V = animSeries().slice();
    const frames = [{ name: "V₀ = Y", y: V.slice() }];
    for (let j = 1; j <= Jmax; j++) {
      const step = MODWT.haarStepDemo(V, j);
      frames.push({ name: "j=" + j + " · Wⱼ", y: step.W, kind: "W" });
      frames.push({ name: "j=" + j + " · Vⱼ  (s=" + step.s + ")", y: step.V, kind: "V" });
      V = step.V;
    }
    const idx = Math.min(state.animStep, frames.length - 1);
    const fr = frames[idx];
    const color = fr.kind === "W" ? COLORS.yhat : COLORS.y;
    Plotly.react("animPlot", [{
      y: fr.y, type: "scatter", mode: "lines",
      line: { color: color, width: 1.4 },
      name: fr.name
    }], plotLayout({
      title: { text: fr.name + "  (" + (idx + 1) + "/" + frames.length + ")", font: { size: 13 } },
      showlegend: false,
      yaxis: { title: "", gridcolor: "#e8ecf1" }
    }), plotCfg);
    document.getElementById("animCaption").textContent =
      "Wⱼ = (V − V_lag)/2 · Vⱼ = (V + V_lag)/2 · lag s = 2^{j−1}";
    return frames.length;
  }

  function playAnim() {
    if (state.animTimer) {
      clearInterval(state.animTimer);
      state.animTimer = null;
      document.getElementById("animPlay").textContent = "Play";
      return;
    }
    document.getElementById("animPlay").textContent = "Pause";
    state.animTimer = setInterval(() => {
      const n = renderAnim(false);
      state.animStep += 1;
      if (state.animStep >= n) {
        state.animStep = 0;
        clearInterval(state.animTimer);
        state.animTimer = null;
        document.getElementById("animPlay").textContent = "Play";
      }
    }, 700);
  }

  /* ---------- MODWT live ---------- */
  function syncMraSensor() {
    const sel = document.getElementById("mraSensor");
    if (!sel) return;
    const keys = Object.keys(datasets());
    if (!sel.options.length) {
      keys.forEach((k) => {
        const o = document.createElement("option");
        o.value = k; o.textContent = k;
        sel.appendChild(o);
      });
    }
    sel.value = state.sensor;
  }

  function renderMra() {
    if (!window.Plotly || !window.MODWT) return;
    const ds = activeSeries();
    const K = parseInt(document.getElementById("mraK").value, 10) || 5;
    document.getElementById("mraKLabel").textContent = String(K);
    const filter = document.getElementById("mraFilter").value || "haar";
    // Keep interactive latency low: use up to 14 days
    const maxN = 24 * 14;
    const y = ds.y.length > maxN ? ds.y.slice(ds.y.length - maxN) : ds.y.slice();
    const t = ds.t.length > maxN ? ds.t.slice(ds.t.length - maxN) : ds.t.slice();
    const m = MODWT.mra(y, K, filter);

    const comps = [];
    comps.push({ name: "Y", y: y, color: COLORS.y });
    for (let j = 0; j < K; j++) {
      comps.push({ name: "D" + (j + 1), y: m.D[j], color: COLORS.D[j % COLORS.D.length] });
    }
    comps.push({ name: "S" + K, y: m.S, color: COLORS.S });

    const nRows = comps.length;
    const data = comps.map((c, i) => {
      const yAxis = i === 0 ? "y" : "y" + (i + 1);
      const xAxis = i === 0 ? "x" : "x" + (i + 1);
      return {
        x: t, y: c.y, type: "scatter", mode: "lines", name: c.name,
        line: { color: c.color, width: 1.15 },
        xaxis: xAxis, yaxis: yAxis,
        hovertemplate: "%{x}<br>" + c.name + ": %{y:.3f}<extra></extra>"
      };
    });

    const layout = plotLayout({
      height: Math.max(420, 68 * nRows),
      showlegend: false,
      margin: { t: 36, r: 16, b: 36, l: 52 },
      title: { text: filter.toUpperCase() + " · K=" + K + " · " + ds.sensor, font: { size: 13 } },
      grid: { rows: nRows, columns: 1, pattern: "independent", roworder: "top to bottom" }
    });
    // Label each row
    for (let i = 0; i < nRows; i++) {
      const key = i === 0 ? "yaxis" : "yaxis" + (i + 1);
      layout[key] = Object.assign({}, layout[key], {
        title: { text: comps[i].name, font: { size: 10 } },
        gridcolor: "#e8ecf1", zeroline: false, tickfont: { size: 9 }
      });
      const xkey = i === 0 ? "xaxis" : "xaxis" + (i + 1);
      layout[xkey] = Object.assign({}, layout[xkey], {
        showticklabels: i === nRows - 1,
        matches: i === 0 ? undefined : "x",
        gridcolor: "#e8ecf1", tickfont: { size: 9 }
      });
    }

    Plotly.react("mraStack", data, layout, plotCfg);

    const en = MODWT.energy(m);
    Plotly.react("mraEnergy", [{
      x: en.map((r) => r.component),
      y: en.map((r) => r.share),
      type: "bar",
      marker: { color: en.map((r) => r.component.startsWith("S") ? COLORS.S : COLORS.energy) },
      hovertemplate: "%{x}: %{y:.1%}<extra></extra>"
    }], plotLayout({
      margin: { t: 10, r: 10, b: 40, l: 40 },
      yaxis: { tickformat: ".0%", gridcolor: "#e8ecf1" },
      showlegend: false
    }), plotCfg);

    document.getElementById("mraHint").textContent =
      "D1 finest (≈2h) · D" + K + " coarsest detail · S" + K + " smooth. Haar additive MRA matches the R port; D4/LA8 use successive smooth differences.";
  }

  /* ---------- CatBoost toy ---------- */
  function renderCatboost() {
    if (!window.Plotly) return;
    const ds = activeSeries();
    const n = Math.min(120, ds.y.length);
    const y = ds.y.slice(ds.y.length - n);
    const x = y.map((_, i) => i);
    // Feature: lag-1; stump ≈ local mean of residuals in bins
    const eta = (parseInt(document.getElementById("cbEta").value, 10) || 15) / 100;
    const M = parseInt(document.getElementById("cbM").value, 10) || 12;
    let F = y.map(() => y.reduce((a, b) => a + b, 0) / y.length);
    for (let m = 0; m < M; m++) {
      const resid = y.map((yi, i) => yi - F[i]);
      // 8-leaf oblivious-style: partition by lag value quartiles of index blocks
      const block = Math.max(4, Math.floor(n / 8));
      const step = new Array(n);
      for (let i = 0; i < n; i++) {
        const lo = Math.floor(i / block) * block;
        const hi = Math.min(n, lo + block);
        let s = 0, c = 0;
        for (let k = lo; k < hi; k++) { s += resid[k]; c++; }
        step[i] = s / c;
      }
      for (let i = 0; i < n; i++) F[i] += eta * step[i];
    }
    Plotly.react("cbPlot", [
      { x: x, y: y, type: "scatter", mode: "lines", name: "y", line: { color: COLORS.y, width: 1.3 } },
      { x: x, y: F, type: "scatter", mode: "lines", name: "F_M", line: { color: COLORS.yhat, width: 1.5 } }
    ], plotLayout({
      title: { text: "η=" + eta.toFixed(2) + " · M=" + M + " · " + state.sensor, font: { size: 13 } },
      xaxis: { title: "t (window)" }
    }), plotCfg);
  }

  /* ---------- Metrics ---------- */
  function uniq(arr) {
    return Array.from(new Set(arr.filter(Boolean))).sort();
  }

  function fillMetricFilters() {
    const sc = scores();
    const sens = uniq(sc.map((r) => r.sensor));
    const pols = uniq(sc.map((r) => r.pollutant));
    const hs = uniq(sc.map((r) => r.horizon));
    function fill(id, vals, prefer) {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = "";
      vals.forEach((v) => {
        const o = document.createElement("option");
        o.value = v; o.textContent = v;
        el.appendChild(o);
      });
      if (prefer && vals.indexOf(prefer) >= 0) el.value = prefer;
      else if (vals.length) el.value = vals[0];
    }
    fill("metSensor", sens, state.sensor);
    fill("metPol", pols, "PM2.5");
    fill("metH", hs, "1d");
  }

  function renderMetrics() {
    if (!window.Plotly) return;
    const sensor = document.getElementById("metSensor").value;
    const pol = document.getElementById("metPol").value;
    const h = document.getElementById("metH").value;
    const score = document.getElementById("metScore").value;
    const rows = scores().filter((r) => r.sensor === sensor && r.pollutant === pol && r.horizon === h);
    rows.sort((a, b) => (a[score] || 99) - (b[score] || 99));
    const best = rows.length ? rows[0][score] : null;

    Plotly.react("metBars", [{
      x: rows.map((r) => r.method),
      y: rows.map((r) => r[score]),
      type: "bar",
      marker: {
        color: rows.map((r) => r[score] === best ? COLORS.yhat : COLORS.energy)
      },
      hovertemplate: "%{x}: %{y:.3f}<extra></extra>"
    }], plotLayout({
      title: { text: score + " · " + sensor + " · " + pol + " · " + h, font: { size: 13 } },
      yaxis: { title: score, gridcolor: "#e8ecf1" },
      showlegend: false
    }), plotCfg);

    const thead = document.querySelector("#metTable thead");
    const tbody = document.querySelector("#metTable tbody");
    thead.innerHTML = "<tr><th>method</th><th>MASE</th><th>MAE</th><th>RMSE</th></tr>";
    tbody.innerHTML = rows.map((r) => {
      const cls = r.MASE === best && score === "MASE" ? " class='best'" : "";
      return "<tr" + cls + "><td>" + r.method + "</td><td>" +
        fmt(r.MASE) + "</td><td>" + fmt(r.MAE) + "</td><td>" + fmt(r.RMSE) + "</td></tr>";
    }).join("");
  }

  function fmt(v) {
    if (v == null || !isFinite(v)) return "—";
    return Number(v).toFixed(3);
  }

  /* ---------- Conformal ---------- */
  function quantile(arr, p) {
    const a = arr.filter((x) => isFinite(x)).slice().sort((u, v) => u - v);
    if (!a.length) return 0;
    const i = (a.length - 1) * p;
    const lo = Math.floor(i), hi = Math.ceil(i);
    if (lo === hi) return a[lo];
    return a[lo] * (hi - i) + a[hi] * (i - lo);
  }

  function renderConformal() {
    if (!window.Plotly) return;
    const conf = learn().conformal;
    if (!conf || !conf.y || !conf.yhat) {
      Plotly.react("confPlot", [], plotLayout({ title: { text: "No conformal series loaded" } }), plotCfg);
      return;
    }
    const pct = parseFloat(document.getElementById("confPct").value) || 0.95;
    const alpha = 1 - pct;
    // Simplified PI: half-width = quantile(|resid|) at pct (educational).
    // Also show weighted flavour: scale by local rolling MAE ratio.
    const resid = conf.y.map((yi, i) => Math.abs(yi - conf.yhat[i]));
    const q = quantile(resid, pct);
    const win = 24;
    const u = resid.map((_, i) => {
      const lo = Math.max(0, i - win + 1);
      let s = 0, c = 0;
      for (let k = lo; k <= i; k++) { s += resid[k]; c++; }
      return Math.max(s / c, 1e-6);
    });
    const cs = resid.map((r, i) => r / u[i]);
    const cq = quantile(cs, pct);
    const half = u.map((ui) => cq * ui);

    const t = conf.y.map((_, i) => i);
    const lower = conf.yhat.map((yh, i) => Math.max(0, yh - half[i]));
    const upper = conf.yhat.map((yh, i) => yh + half[i]);
    const cover = conf.y.filter((yi, i) => yi >= lower[i] && yi <= upper[i]).length / conf.y.length;

    document.getElementById("confMeta").textContent =
      "α=" + alpha.toFixed(2) + " · CQ=" + cq.toFixed(2) + " · empir. cover=" + (100 * cover).toFixed(1) + "% · q|e|=" + q.toFixed(2);

    Plotly.react("confPlot", [
      {
        x: t.concat(t.slice().reverse()),
        y: upper.concat(lower.slice().reverse()),
        fill: "toself",
        fillcolor: COLORS.band,
        line: { color: "transparent" },
        name: (100 * pct).toFixed(0) + "% PI",
        hoverinfo: "skip"
      },
      { x: t, y: conf.y, type: "scatter", mode: "lines", name: "Y", line: { color: COLORS.y, width: 1.2 } },
      { x: t, y: conf.yhat, type: "scatter", mode: "lines", name: "Ŷ", line: { color: COLORS.yhat, width: 1.3 } },
      { x: t, y: upper, type: "scatter", mode: "lines", name: "upper", line: { color: COLORS.bandLine, width: 1, dash: "dot" } },
      { x: t, y: lower, type: "scatter", mode: "lines", name: "lower", line: { color: COLORS.bandLine, width: 1, dash: "dot" } }
    ], plotLayout({
      title: { text: (conf.sensor || "CPCB") + " · " + (conf.horizon || "7d") + " · band " + (100 * pct).toFixed(0) + "%", font: { size: 13 } },
      yaxis: { title: "µg/m³", gridcolor: "#e8ecf1" },
      xaxis: { title: "test hour" }
    }), plotCfg);
  }

  /* ---------- boot ---------- */
  function boot() {
    const keys = Object.keys(datasets());
    if (keys.length && keys.indexOf(state.sensor) < 0) state.sensor = keys[0];

    document.querySelectorAll("#nav button").forEach((b) => {
      b.addEventListener("click", () => showPage(b.dataset.page));
    });
    document.getElementById("lightbox").addEventListener("click", () => {
      document.getElementById("lightbox").classList.remove("on");
    });

    syncMraSensor();
    document.getElementById("mraSensor").addEventListener("change", (e) => setSensor(e.target.value));
    document.getElementById("mraFilter").addEventListener("change", renderMra);
    document.getElementById("mraK").addEventListener("input", renderMra);

    document.getElementById("animPlay").addEventListener("click", playAnim);
    document.getElementById("animReset").addEventListener("click", () => {
      state.animStep = 0;
      renderAnim(true);
    });
    document.getElementById("animJ").addEventListener("change", () => {
      state.animStep = 0;
      renderAnim(true);
    });

    ["cbEta", "cbM"].forEach((id) => {
      document.getElementById(id).addEventListener("input", renderCatboost);
    });
    document.getElementById("cbReplay").addEventListener("click", renderCatboost);

    fillMetricFilters();
    ["metSensor", "metPol", "metH", "metScore"].forEach((id) => {
      document.getElementById(id).addEventListener("change", renderMetrics);
    });
    document.getElementById("confPct").addEventListener("change", renderConformal);

    renderEda();
    renderHome();
    renderData();
    renderEdaSeries();
    renderMra();
    renderAnim(true);
    renderCatboost();
    renderMetrics();
    renderConformal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 0));
  } else {
    setTimeout(boot, 0);
  }
})();
