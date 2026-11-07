/* Client-side MODWT / MRA for the learn app (Haar matches R/core/04_modwt.R). */
(function (global) {
  "use strict";

  const FILTERS = {
    haar: {
      label: "Haar",
      // Paper recursion uses average / difference (g = h with sign flip).
      g: [0.5, 0.5],
      h: [0.5, -0.5]
    },
    d4: {
      label: "D4",
      // waveslim::wave.filter("d4") scaling (g) + wavelet (h)
      g: [0.4829629131445341, 0.8365163037378079, 0.2241438680420134, -0.1294095225512604],
      h: [-0.1294095225512604, -0.2241438680420134, 0.8365163037378079, -0.4829629131445341]
    },
    la8: {
      label: "LA8",
      g: [
        -0.0757657147893407, -0.0296355276459541, 0.4976186676325621, 0.8037387518052163,
        0.2978577956055422, -0.0992195435769564, -0.0126039672622618, 0.0322231006040713
      ],
      h: [
        -0.0322231006040713, -0.0126039672622618, 0.0992195435769564, 0.2978577956055422,
        -0.8037387518052163, 0.4976186676325621, 0.0296355276459541, -0.0757657147893407
      ]
    }
  };

  function rollRight(x, s) {
    const n = x.length;
    s = ((s % n) + n) % n;
    if (s === 0) return x.slice();
    return x.slice(n - s).concat(x.slice(0, n - s));
  }

  function rollLeft(x, s) {
    const n = x.length;
    s = ((s % n) + n) % n;
    if (s === 0) return x.slice();
    return x.slice(s).concat(x.slice(0, s));
  }

  function convCircular(x, taps, stride) {
    const n = x.length;
    const L = taps.length;
    const out = new Array(n);
    for (let t = 0; t < n; t++) {
      let s = 0;
      for (let l = 0; l < L; l++) {
        const idx = (t - stride * l + n * 64) % n;
        s += taps[l] * x[idx];
      }
      out[t] = s;
    }
    return out;
  }

  function haarModwt(x, J) {
    let V = x.slice();
    const W = [];
    for (let j = 1; j <= J; j++) {
      const s = 1 << (j - 1);
      const Vlag = rollRight(V, s);
      const Wj = new Array(V.length);
      const Vn = new Array(V.length);
      for (let i = 0; i < V.length; i++) {
        Wj[i] = (V[i] - Vlag[i]) / 2;
        Vn[i] = (V[i] + Vlag[i]) / 2;
      }
      W.push(Wj);
      V = Vn;
    }
    return { W, V, J };
  }

  function haarInverseStep(Wj, Vj, j) {
    const s = 1 << (j - 1);
    const Wl = rollLeft(Wj, s);
    const Vl = rollLeft(Vj, s);
    const out = new Array(Wj.length);
    for (let i = 0; i < Wj.length; i++) {
      out[i] = (Wj[i] - Wl[i] + Vj[i] + Vl[i]) / 2;
    }
    return out;
  }

  function haarImodwt(W, VJ) {
    let V = VJ.slice();
    for (let j = W.length; j >= 1; j--) {
      V = haarInverseStep(W[j - 1], V, j);
    }
    return V;
  }

  function haarMra(x, J) {
    const wt = haarModwt(x, J);
    const zeros = wt.W.map((w) => w.map(() => 0));
    const D = [];
    for (let j = 0; j < J; j++) {
      const Wj = zeros.map((z) => z.slice());
      Wj[j] = wt.W[j].slice();
      D.push(haarImodwt(Wj, wt.V.map(() => 0)));
    }
    const S = haarImodwt(zeros, wt.V);
    return { D, S, J, filter: "haar" };
  }

  /** Generic MODWT coefficients (circular à trous). */
  function genericModwt(x, J, name) {
    const f = FILTERS[name] || FILTERS.haar;
    let V = x.slice();
    const W = [];
    for (let j = 1; j <= J; j++) {
      const stride = 1 << (j - 1);
      W.push(convCircular(V, f.h, stride));
      V = convCircular(V, f.g, stride);
    }
    return { W, V, J };
  }

  /**
   * Additive MRA via successive smooths (works for Haar/D4/LA8 demos).
   * D_j = V_{j-1} - V_j, S = V_J  →  x = sum D + S.
   */
  function smoothMra(x, J, name) {
    const f = FILTERS[name] || FILTERS.haar;
    let Vprev = x.slice();
    const D = [];
    for (let j = 1; j <= J; j++) {
      const stride = 1 << (j - 1);
      const V = convCircular(Vprev, f.g, stride);
      const Dj = new Array(V.length);
      for (let i = 0; i < V.length; i++) Dj[i] = Vprev[i] - V[i];
      D.push(Dj);
      Vprev = V;
    }
    return { D, S: Vprev, J, filter: name };
  }

  function mra(x, J, filter) {
    const name = (filter || "haar").toLowerCase();
    const y = x.map(Number);
    if (name === "haar") return haarMra(y, J);
    return smoothMra(y, J, name);
  }

  function energy(m) {
    const rows = m.D.map((d, i) => {
      const e = d.reduce((a, b) => a + b * b, 0);
      return { component: "D" + (i + 1), energy: e };
    });
    const se = m.S.reduce((a, b) => a + b * b, 0);
    rows.push({ component: "S" + m.J, energy: se });
    const tot = rows.reduce((a, r) => a + r.energy, 0) || 1;
    return rows.map((r) => Object.assign(r, { share: r.energy / tot }));
  }

  function reconstruct(m) {
    const out = m.S.slice();
    for (let j = 0; j < m.D.length; j++) {
      for (let i = 0; i < out.length; i++) out[i] += m.D[j][i];
    }
    return out;
  }

  /** One Haar step animation frame: show Vlag, W, V from current V. */
  function haarStepDemo(V, j) {
    const s = 1 << (j - 1);
    const Vlag = rollRight(V, s);
    const W = V.map((v, i) => (v - Vlag[i]) / 2);
    const Vn = V.map((v, i) => (v + Vlag[i]) / 2);
    return { Vlag, W, V: Vn, s, j };
  }

  global.MODWT = {
    FILTERS,
    mra,
    energy,
    reconstruct,
    haarModwt,
    haarMra,
    haarStepDemo,
    rollRight,
    rollLeft
  };
})(window);
