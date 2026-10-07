# ADR-003: Code Hosting & App Hosting (HTTPS for phones)

- **Date:** 2026-10-08
- **Status:** Accepted (chosen by user)
- **Roadmap item:** Phase 0: serve over HTTPS and install on real phones

## Context
Phones only allow the camera, service worker and home-screen install on an HTTPS address. A stable address matters because an installed PWA is tied to the origin it was installed from. We also need version control.

## Options

### Option A: GitHub Pages, public repo
Code on GitHub; a GitHub Actions workflow builds `app/` and publishes it to `https://<user>.github.io/gymbro/` on every push to `main`.
- **Pros:** One account; free; automatic deploys; stable HTTPS address.
- **Cons:** Code and planning docs are public; the app is served under a `/gymbro/` path (handled with Vite `base`); Pages has no custom headers or server functions (not needed: the backend is Supabase).
- **Works without app store:** ✅
- **Effort / cost:** S, free

### Option B: Private GitHub repo + Netlify
- **Pros:** Private code; auto deploys; preview URL per branch.
- **Cons:** Two accounts.
- **Works without app store:** ✅
- **Effort / cost:** S, free

### Option C: GitHub Pages, private repo
- **Pros:** One place, private code.
- **Cons:** Requires GitHub Pro ($4/month); same `/gymbro/` path handling.
- **Works without app store:** ✅
- **Effort / cost:** S, $4/mo

Also considered for HTTPS: a Cloudflare quick tunnel (the address changes each run, which breaks installed PWAs) and local mkcert certificates (each phone must trust a certificate; same Wi-Fi only).

## Decision
**Option A: GitHub Pages from a public repo.** It's the simplest, free, and gives a stable HTTPS address.

Implementation:
- `.github/workflows/deploy.yml`: Node 26 → `npm ci` → lint → build with `BASE_PATH=/<repo>/` → deploy to Pages.
- `app/vite.config.ts`: `base` comes from `BASE_PATH` (default `/` for local dev). The manifest `start_url`/`scope` and service worker scope follow `base`.
- In code, reference `public/` assets through `import.meta.env.BASE_URL`, never with hard-coded `/` paths.

## Consequences
- **Never commit secrets.** The repo is public. API keys go in GitHub Actions secrets or Supabase Edge Function env vars, never in the code. Anything shipped to the browser (e.g. the Supabase anon key) is public by design and must be protected by row-level security.
- Commit author emails are public. Use the GitHub noreply email if preferred.
- **Revisit if:** the code needs to become private (→ Option B), or a custom domain is wanted (Pages supports it for free).
