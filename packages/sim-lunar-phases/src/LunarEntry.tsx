import { NavLink, Outlet } from "react-router";

/**
 * Section definitions for the Sun/Earth/Moon phenomenon.
 * Each entry becomes a sub-nav link and a route.
 */
const sections = [
  { path: "",                label: "Overview" },
  { path: "lunar-phases",   label: "Lunar Phases" },
  { path: "solar-eclipses", label: "Solar Eclipses" },
  { path: "lunar-eclipses", label: "Lunar Eclipses" },
  { path: "observer",       label: "Observer View" },
  { path: "sandbox",        label: "Sandbox" },
] as const;

/**
 * LunarEntry — layout component for the Sun/Earth/Moon suite.
 *
 * Renders the section sub-nav and an <Outlet> for the active section.
 * The site shell mounts this at /sun-earth-moon with nested child routes.
 */
export function LunarEntry() {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Section sub-nav */}
      <nav className="flex items-center gap-1 px-6 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
        {sections.map(({ path, label }) => (
          <NavLink
            key={path}
            to={path === "" ? "/sun-earth-moon" : `/sun-earth-moon/${path}`}
            end={path === ""}
            className={({ isActive }) =>
              [
                "px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors",
                isActive
                  ? "bg-[var(--color-accent)] text-white font-medium"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]",
              ].join(" ")
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Active section content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
