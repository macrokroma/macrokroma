# macrokroma — Developer Workflow

## Start of Session

Every time you sit down to work, run these from the project directory:

```bash
git pull
pnpm install
pnpm dev
```

- `git pull` syncs any changes pushed from your other machine.
- `pnpm install` updates dependencies if `pnpm-lock.yaml` changed. Safe to run every time — it's instant if nothing changed.
- `pnpm dev` starts the local dev server at `http://localhost:5173`.

## End of Session

Before closing up, verify the build works, then push:

```bash
# Stop the dev server (Ctrl+C)

pnpm build
git add .
git commit -m "describe what you changed"
git push origin main
```

- `pnpm build` runs the production build locally. If this fails, Cloudflare will also fail — fix any errors before pushing.
- `git push origin main` triggers Cloudflare Pages to auto-build and deploy to macrokroma.com.

## Quick Reference

| Action | Command |
|--------|---------|
| Start dev server | `pnpm dev` |
| Stop dev server | `Ctrl+C` (then `Y` on Windows) |
| Production build check | `pnpm build` |
| Pull latest code | `git pull` |
| Stage all changes | `git add .` |
| Commit | `git commit -m "message"` |
| Push & deploy | `git push origin main` |
| Install dependencies | `pnpm install` |

## Two-Machine Setup

You work from both a Windows PC and a MacBook. The repo is cloned on both, using SSH keys tied to the `macrokroma` GitHub account.

- **Windows:** `C:\Users\zdavico\PycharmProjects\macrokroma`
- **Mac:** `/Users/zekufo/PycharmProjects/macrokroma`

Always `git pull` when switching machines. Always `pnpm build` + `git push` when you're done on a machine.

## SSH Config

Both machines have `~/.ssh/config` set up with host aliases:

- `github.com-macrokroma` → uses the macrokroma SSH key
- `github.com-zdavico` → uses the zdavico SSH key

The repo remote is `git@github.com-macrokroma:macrokroma/macrokroma.git`.

## Deployment

Cloudflare Pages is connected to the `main` branch. Every push to `main` triggers an automatic build and deploy. The build command is `pnpm install && pnpm build` and the output directory is `packages/site-shell/dist`.

If a deploy fails, check the build log at: Cloudflare Dashboard → Workers & Pages → macrokroma → Deployments.

The most common cause of deploy failures is TypeScript errors that weren't caught locally — which is why you always run `pnpm build` before pushing.
