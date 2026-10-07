# GymBro app (PWA)

React + TypeScript + Vite + `vite-plugin-pwa`. See [ADR-001](../decisions/ADR-001-distribution-and-platform.md) and [ADR-002](../decisions/ADR-002-ui-framework.md).

## Commands
Node is installed via Homebrew. If `node` isn't found, run `export PATH=/opt/homebrew/bin:$PATH`.

```bash
npm install        # install dependencies
npm run dev        # dev server (also on your LAN IP; camera needs HTTPS on phones)
npm run build      # type-check + production build with service worker → dist/
npm run preview    # serve the production build locally
npm run lint       # oxlint
```

## Structure
```
public/            logo.svg + generated PWA icons
src/
  App.tsx          app shell
  components/      InstallHint, DeviceCheck
  lib/             deviceCheck.ts: browser capability checks
```
