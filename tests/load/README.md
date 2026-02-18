# Load Test Pack

This folder includes baseline, spike, stress and soak scripts for the membership platform.

## Artillery

Run against local dev server:

```bash
npm run load:artillery:smoke
npm run load:artillery:baseline
npm run load:artillery:spike
npm run load:artillery:stress
npm run load:artillery:soak
```

Target another environment:

```bash
artillery run -t https://your-domain tests/load/artillery/baseline.yml
```

## k6

```bash
npm run load:k6
PROFILE=spike BASE_URL=https://your-domain k6 run tests/load/k6/membership-load.js
```

Profiles: `baseline`, `spike`, `stress`, `soak`.
