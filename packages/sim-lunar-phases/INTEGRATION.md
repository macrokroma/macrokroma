# Sun/Earth/Moon Simulation — Integration Guide

## What this package contains

`@macrokroma/sim-lunar-phases` is the second simulation suite for macrokroma.com.
It provides an astronomically accurate ephemeris engine (Meeus algorithms) that
computes the real positions of the Sun and Moon for any date, along with phase
information, eclipse detection, and observer-specific sky coordinates.

### Computation engine (the heart of it)
- **Julian Date conversion** — calendar ↔ JD ↔ JavaScript Date
- **Nutation & obliquity** — IAU 1980 63-term series
- **Solar position** — ~0.01° accuracy in longitude
- **Lunar position** — ELP-2000/82 major terms (~10" accuracy)
- **Coordinate transforms** — ecliptic ↔ equatorial ↔ horizontal (alt/az)
- **Phase computation** — illuminated fraction, phase name, bright limb angle
- **Eclipse detection** — solar and lunar eclipse proximity + classification

### UI structure
- `LunarEntry` — layout with sub-nav (same pattern as ABEffectEntry)
- `LunarOverview` — live ephemeris dashboard (proof-of-life for the engine)
- Placeholder views for: Lunar Phases, Solar Eclipses, Lunar Eclipses, Observer View, Sandbox

---

## Step-by-step integration

### 1. Copy the package

Copy the entire `sim-lunar-phases` folder into `packages/`:

```
packages/
  shared/
  sim-ab-effect/
  sim-lunar-phases/    ← this new folder
  site-shell/
```

### 2. Add workspace dependency to site-shell

Edit `packages/site-shell/package.json` and add to `"dependencies"`:

```json
"@macrokroma/sim-lunar-phases": "workspace:*"
```

### 3. Add Tailwind source scanning

Edit `packages/site-shell/src/index.css` and add a new `@source` line:

```css
@import "tailwindcss";
@source "../../shared/src/**/*.{ts,tsx}";
@source "../../sim-ab-effect/src/**/*.{ts,tsx}";
@source "../../sim-lunar-phases/src/**/*.{ts,tsx}";
```

### 4. Update App.tsx

This is the main change. Add the imports and routes for the new suite.
Here's what to add to `packages/site-shell/src/App.tsx`:

**Add imports** (alongside the existing AB effect imports):

```tsx
import {
  LunarEntry,
  LunarOverview,
  LunarPhases,
  SolarEclipses,
  LunarEclipses,
  ObserverViewSection,
  LunarSandbox,
} from "@macrokroma/sim-lunar-phases";
```

**Add a nav link** in the `<nav>` element (next to the Aharonov–Bohm link):

```tsx
<Link
  to="/sun-earth-moon"
  className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
>
  Sun / Earth / Moon
</Link>
```

**Add routes** inside `<Routes>` (alongside the existing AB effect routes):

```tsx
<Route path="/sun-earth-moon" element={<LunarEntry />}>
  <Route index element={<LunarOverview />} />
  <Route path="lunar-phases" element={<LunarPhases />} />
  <Route path="solar-eclipses" element={<SolarEclipses />} />
  <Route path="lunar-eclipses" element={<LunarEclipses />} />
  <Route path="observer" element={<ObserverViewSection />} />
  <Route path="sandbox" element={<LunarSandbox />} />
</Route>
```

### 5. Install dependencies

```bash
pnpm install
```

### 6. Run

```bash
pnpm dev
```

Navigate to `http://localhost:5173/sun-earth-moon` — you should see the
overview dashboard with live ephemeris data for the current date/time.

---

## What to verify

After integration, the overview page should show:
- **Current UTC date/time** matching your system clock
- **Moon phase name** — cross-check with any lunar phase website
- **Illumination percentage** — should match within ~1%
- **Moon distance** — should be between ~356,000 and ~407,000 km
- **Sun distance** — should be ~1.0 AU (varies ±0.017 AU over the year)
- **Eclipse proximity** — should show "No" for most dates

Try the time controls: step forward one month and watch the phase cycle
through its 29.5-day period. The phase name should cycle through all eight
phases in order.

---

## What comes next

The computation engine is complete and ready to power all the visualizations.
The next steps are:

1. **3D orbital viewport** — Earth, Moon, Sun at computed positions with R3F
2. **Moon phase rendering** — Correct illumination from Sun's direction
3. **Observer sky view** — Hemispherical projection of the local sky
4. **Eclipse visualization** — Shadow cones, ground tracks, eclipse maps
5. **Earth textures** — Day/night terminator, realistic rendering
6. **Moon textures** — Albedo map with libration
