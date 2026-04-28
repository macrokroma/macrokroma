import { NavLink, Outlet } from "react-router";

/**
 * Section definitions for the AB effect phenomenon.
 * Each entry becomes a sub-nav link and a route.
 */
const sections = [
  { path: "",              label: "Overview" },
  { path: "double-slit",   label: "Double-Slit" },
  { path: "vector-potential", label: "Vector Potential" },
  { path: "solenoid",      label: "Solenoid" },
  { path: "phase-shift",   label: "Phase Shift" },
  { path: "wavefunction",  label: "Wavefunction" },
  { path: "sandbox",       label: "Sandbox" },
] as const;

/**
 * ABEffectEntry — layout component for the Aharonov-Bohm effect suite.
 *
 * Renders the section sub-nav and an <Outlet> for the active section.
 * The site shell mounts this at /ab-effect with nested child routes.
 */
export function ABEffectEntry() {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Section sub-nav */}
      <nav className="flex items-center gap-1 px-6 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
        {sections.map(({ path, label }) => (
          <NavLink
            key={path}
            to={path === "" ? "/ab-effect" : `/ab-effect/${path}`}
            end={path === ""}
            className={({ isActive }) =>
              [
                "px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors",
                isActive
                  ? "bg-[var(--color-accent)] text-white font-medium"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]",
              ].join(" ")
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Active section content */}
      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  );
}