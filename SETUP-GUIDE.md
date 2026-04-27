# macrokroma — Monorepo Setup Guide

Step-by-step instructions for setting up the physics simulation monorepo on your Windows machine (PyCharm), with notes for macOS. This guide explains *what* each step does and *why*, so you're learning the toolchain as you build.

---

## Prerequisites

Before you start, make sure you have these installed:

**Node.js 20+** — The JavaScript runtime. Check with `node --version`. If you need to install or switch versions, [nvm-windows](https://github.com/coreybutler/nvm-windows) is the standard way on Windows, and [nvm](https://github.com/nvm-sh/nvm) on macOS. The `.nvmrc` file in the repo root tells nvm which version to use.

**pnpm** — The package manager. Install it globally: `npm install -g pnpm`. Check with `pnpm --version`. We need 9.x+. pnpm is faster and more disk-efficient than npm because it hard-links packages from a central store instead of copying them into every project. In a monorepo with many packages that share the same dependencies (React, Three.js), this matters.

**Git** — You almost certainly have this already. Check with `git --version`.

---

## Step 1: Create the macrokroma GitHub account and repo

You mentioned you already have the `macrokroma` username on GitHub. You'll need to configure Git to push to this account rather than your personal `zdavico` account. Here's how:

**1a. Create the repository on GitHub.** Log into your `macrokroma` GitHub account. Create a new repository called `macrokroma` (or whatever you want the repo name to be). Don't initialize it with a README — we'll push our local scaffold to it.

**1b. Set up SSH keys for the macrokroma account.** If you're already using SSH for your `zdavico` account, you'll need a second SSH key for the macrokroma account. On Windows (Git Bash or PowerShell):

```bash
# Generate a new SSH key specifically for the macrokroma account
ssh-keygen -t ed25519 -C "your-macrokroma-email@example.com" -f ~/.ssh/id_macrokroma
```

This creates two files: `~/.ssh/id_macrokroma` (private key) and `~/.ssh/id_macrokroma.pub` (public key). Add the **public** key to your macrokroma GitHub account at github.com → Settings → SSH and GPG keys → New SSH key.

**1c. Configure SSH to use the right key for each account.** Edit (or create) `~/.ssh/config`:

```
# Personal GitHub (zdavico)
Host github.com-zdavico
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519

# macrokroma GitHub
Host github.com-macrokroma
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_macrokroma
```

What this does: when you clone or push using `github.com-macrokroma` as the hostname, SSH knows to use the macrokroma key. When you use `github.com-zdavico`, it uses your personal key. Both point to `github.com` under the hood.

**1d. On macOS (when you get there),** repeat the SSH key generation and config. The paths and commands are identical — `~/.ssh/config` works the same way on both OSes. If you want to share the private key between machines instead of generating a new one, you can securely copy `id_macrokroma` from Windows to macOS (but generating a second key per machine is often cleaner).

---

## Step 2: Initialize the local repo

Open a terminal in PyCharm (or use PowerShell / Git Bash). Navigate to where you want the project to live:

```bash
# Pick wherever you keep code. Example:
cd C:\Users\YourName\Projects

# Create the directory and enter it
mkdir macrokroma
cd macrokroma

# Initialize git
git init

# Set the git user for this repo to the macrokroma identity
# (so commits aren't attributed to your personal account)
git config user.name "macrokroma"
git config user.email "your-macrokroma-email@example.com"

# Add the remote using the SSH config alias from Step 1c
git remote add origin git@github.com-macrokroma:macrokroma/macrokroma.git
```

The `git config` commands here are **local** to this repo (no `--global` flag), so they only affect commits made inside this directory. Your personal projects still use your zdavico identity.

---

## Step 3: Copy the scaffold files into the repo

The scaffold I've created for you is a complete set of files. You'll need to copy them into the `macrokroma` directory you just created.

**From this chat,** download the scaffold (I'll provide it as a downloadable archive). Then extract it so the directory looks like this:

```
macrokroma/
├── .gitignore
├── .npmrc
├── .nvmrc
├── package.json            ← monorepo root
├── pnpm-workspace.yaml     ← tells pnpm where the packages are
├── turbo.json              ← Turborepo pipeline (task dependencies + caching)
├── tsconfig.json           ← shared TypeScript config
└── packages/
    ├── shared/             ← @macrokroma/shared — physics math, 3D primitives, hooks
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── components/
    │       │   └── WebGPUCanvas.tsx
    │       ├── hooks/
    │       │   └── useSimulation.ts
    │       ├── math/
    │       │   └── complex.ts
    │       └── shaders/
    │           └── phaseColor.ts
    ├── sim-ab-effect/      ← @macrokroma/sim-ab-effect — Aharonov-Bohm suite
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── ABEffectEntry.tsx
    │       ├── compute/
    │       │   └── interference.ts
    │       ├── store/
    │       │   └── abStore.ts
    │       └── views/
    │           └── ABInterference.tsx
    └── site-shell/         ← @macrokroma/site-shell — Vite app, routing, layout
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts
        ├── vite-env.d.ts
        ├── index.html
        └── src/
            ├── main.tsx
            ├── App.tsx
            ├── index.css
            └── pages/
                └── Landing.tsx
```

---

## Step 4: Install dependencies

This is where the monorepo magic happens:

```bash
pnpm install
```

**What this does:** pnpm reads `pnpm-workspace.yaml`, discovers all three packages under `packages/`, and installs their dependencies. Because `@macrokroma/shared` and `@macrokroma/sim-ab-effect` are listed as `"workspace:*"` dependencies of the site shell, pnpm **symlinks** them instead of downloading them from npm. This means when you edit a file in `packages/shared/src/`, the site shell sees the change instantly — no build step needed for development.

The `shamefully-hoist=true` setting in `.npmrc` hoists all dependencies to the root `node_modules/`. This is a pragmatic concession: some Three.js ecosystem packages (particularly post-processing) expect to find sibling packages in a flat node_modules structure. Without hoisting, they fail to resolve each other. The trade-off is slightly less strict isolation, but it's the standard approach for Three.js monorepos.

---

## Step 5: Run the dev server

```bash
pnpm dev
```

**What this does:** pnpm runs the `dev` script defined in the root `package.json`, which calls `turbo run dev`. Turborepo reads `turbo.json`, sees that `dev` depends on `^build` (meaning "build my dependencies first"), but since `shared` and `sim-ab-effect` don't have a `build` script that produces output (they export raw TypeScript that Vite compiles on the fly), Turbo skips that and starts the Vite dev server in `site-shell`.

Vite starts at `http://localhost:5173`. Open it in Chrome (Chrome has the best WebGPU support). You should see:

- A dark page with the "macrokroma" heading
- A navigation bar with a link to "Aharonov–Bohm"
- A spinning wireframe icosahedron rendered via WebGPU (or WebGL 2 fallback)

If the icosahedron appears, **the entire stack is working**: Vite is bundling, React is rendering, R3F is running Three.js scenes in JSX, and the WebGPU renderer is active.

Click "Aharonov–Bohm" in the nav. You should see the interference view with a flux slider and a bar chart. Drag the slider — the bar pattern should shift. This proves:

- Cross-package imports work (`sim-ab-effect` imports from `shared`)
- Zustand state management works (slider updates store, store drives computation)
- The `useSimulation` hook works (recomputes on parameter change)
- React Router works (URL changes to `/ab-effect`)

---

## Step 6: Make your first commit and push

```bash
git add .
git commit -m "feat: initial monorepo scaffold

- pnpm workspace + Turborepo pipeline
- @macrokroma/shared: WebGPUCanvas, useSimulation hook, complex math
- @macrokroma/sim-ab-effect: AB interference computation + store + view
- @macrokroma/site-shell: Vite + React + R3F + Tailwind + routing"

git push -u origin main
```

If git complains about the branch name, you may need `git branch -M main` first (some git installations default to `master`).

---

## Understanding the architecture

Here's what each piece does and why it exists:

**`package.json` (root)** — Marks this as a private monorepo (never published to npm). The `scripts` delegate everything to Turborepo. The `packageManager` field tells pnpm-aware tools which version to use. The `engines` field prevents accidentally running on old Node.

**`pnpm-workspace.yaml`** — One line: `packages: ["packages/*"]`. This tells pnpm that every directory under `packages/` is an independent package with its own `package.json`. pnpm resolves `workspace:*` dependencies by symlinking to the local directory rather than downloading from npm.

**`turbo.json`** — Defines the task dependency graph. `"build": { "dependsOn": ["^build"] }` means "before building a package, build everything it depends on first." The `^` means "transitive" — if A depends on B which depends on C, build C, then B, then A. The `"dev": { "cache": false, "persistent": true }` means the dev task is a long-running server (don't cache it, don't kill it when other tasks finish).

**`tsconfig.json` (root)** — Shared TypeScript settings. Every package extends this with `"extends": "../../tsconfig.json"`. This keeps type-checking behavior consistent across the entire monorepo. The key settings: `"moduleResolution": "bundler"` (tells TypeScript that Vite resolves modules, not Node), `"verbatimModuleSyntax": true` (enforces explicit `type` imports, which helps bundlers tree-shake), `"noUncheckedIndexedAccess": true` (makes array access return `T | undefined`, catching off-by-one errors).

**`@macrokroma/shared`** — The library package. No build step: it exports raw `.ts` files, and the consuming app (site-shell) compiles them through Vite. This is the simplest monorepo pattern for internal libraries — you get type safety and HMR without a separate build pipeline. The `exports` field in `package.json` tells bundlers where to find the package entry point.

**`@macrokroma/sim-ab-effect`** — The first simulation suite. Same pattern as shared: raw TypeScript exports, consumed directly by the site shell. Owns its own Zustand store, compute functions, and views. Future suites (Casimir, etc.) will follow this exact same structure.

**`@macrokroma/site-shell`** — The only package with a Vite config, because it's the only package that actually produces a runnable app. It imports from `shared` and `sim-ab-effect` via the workspace protocol. Vite resolves these imports to the local source files and compiles everything together.

---

## Cross-platform notes (Windows ↔ macOS)

The scaffold is fully cross-platform. A few things to watch for:

**Line endings.** Add a `.gitattributes` file if you haven't already (I'd recommend adding `* text=auto eol=lf`). This forces LF line endings in the repo regardless of OS, preventing noisy diffs when switching between Windows (CRLF) and macOS (LF).

**Path separators.** Everything in the scaffold uses forward slashes, which work on both OSes in Node.js and pnpm.

**SSH config.** You'll need to set up `~/.ssh/config` on both machines (Step 1c/1d). The macrokroma SSH key either needs to be on both machines or you generate a separate one per machine and add both public keys to the GitHub account.

**pnpm store.** pnpm's package store is per-machine. When you clone on macOS and run `pnpm install`, it downloads everything fresh into the macOS pnpm store. This is normal and fast.

---

## What's next

The scaffold is a working skeleton. The next sessions would build on it:

1. **Recharts integration** — Replace the ASCII bar chart in ABInterference with a proper `<LineChart>` showing the interference pattern
2. **3D viewport** — Add an R3F scene to the AB view showing the solenoid, electron paths, and vector field
3. **More parameter controls** — Expose wavelength, slit separation, and screen distance as sliders
4. **Web Worker tier** — Move `computeInterference` to a worker via the `useSimulation` hook
5. **MDX theory section** — Write the AB effect explanation with inline interactive components
6. **Cloudflare Pages deployment** — Connect the repo and ship it to macrokroma.com
