# WaveCatBoost Learn

Interactive educational site for juniors: datasets → EDA → MODWT → CatBoost → metrics → conformal → extensions.

Static site — no backend.

## Open locally

```bash
python -m http.server 8765
```

Visit `http://localhost:8765`.

## Deploy (GitHub Pages)

Settings → Pages → Deploy from branch **main** → folder **/ (root)**.

Site: `https://<user>.github.io/wavecatboost-learn/`

If the app is served under a subpath, set a `<base href="...">` only if relative assets break (they should work as-is).

## Stack

- HTML / CSS / vanilla JS
- Plotly.js (CDN) for zoomable charts
- Client-side Haar MODWT; D4/LA8 via successive smooth MRA

Paper: [IEEE 10806566](https://ieeexplore.ieee.org/document/10806566)
