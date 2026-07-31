import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, Settings } from "lucide-react";
import { TOOLS, type ToolSpec } from "../../lib/tools";

type Category = ToolSpec["category"];

interface NavSection {
  category: Category;
  label: string;
  accent: string;
  items: ToolSpec[];
}

const CATEGORIES: { category: Category; label: string; accent: string }[] = [
  { category: "image", label: "Image", accent: "var(--color-accent-gold)" },
  { category: "video", label: "Video", accent: "var(--color-accent-steel)" },
  { category: "pdf", label: "PDF", accent: "var(--color-accent-signal)" },
  { category: "audio", label: "Audio", accent: "var(--color-accent-sage)" },
];

const sections: NavSection[] = CATEGORIES.map((meta) => ({
  ...meta,
  items: TOOLS.filter((tool) => tool.category === meta.category),
}));

export function Sidebar() {
  const location = useLocation();
  const [expanded, setExpanded] = useState<Partial<Record<Category, boolean>>>(() => {
    const active = sections.find((section) =>
      location.pathname.startsWith(`/${section.category}/`),
    );
    return active ? { [active.category]: true } : {};
  });

  const toggle = (category: Category) =>
    setExpanded((current) => ({
      ...current,
      [category]:
        !(current[category] ?? location.pathname.startsWith(`/${category}/`)),
    }));

  const isSectionExpanded = (category: Category) =>
    expanded[category] ?? location.pathname.startsWith(`/${category}/`);

  return (
    <aside
      className="flex w-[220px] shrink-0 select-none flex-col border-r border-sidebar-border"
      style={{
        background: "var(--color-sidebar-bg)",
        color: "var(--color-sidebar-active)",
      }}
    >
      <NavLink
        to="/"
        aria-label="OpenExpress home"
        className="press-feedback block border-b border-sidebar-border px-4 py-5"
      >
        <div
          aria-hidden="true"
          className="w-full"
          style={{
            height: 50,
            background: "var(--color-sidebar-active)",
            WebkitMask: "url('/openexpress-logo.svg') center / contain no-repeat",
            mask: "url('/openexpress-logo.svg') center / contain no-repeat",
          }}
        />
      </NavLink>

      <nav className="flex-1 overflow-y-auto py-3">
        {sections.map((section, sIdx) => (
          <div
            key={section.category}
            className={sIdx > 0 ? "border-t border-sidebar-border" : ""}
          >
            <button
              type="button"
              onClick={() => toggle(section.category)}
              aria-expanded={isSectionExpanded(section.category)}
              aria-controls={`nav-section-${section.category}`}
              className="press-feedback flex w-full items-center gap-2.5 px-4 py-2.5 hover:bg-sidebar-hover"
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: section.accent,
                  display: "inline-block",
                }}
              />
              <span
                className="flex-1 text-left"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 0,
                  textTransform: "uppercase",
                  color: "var(--color-sidebar-active)",
                }}
              >
                {section.label}
              </span>
              <span
                aria-hidden
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--color-sidebar-text)",
                }}
              >
                {String(section.items.length).padStart(2, "0")}
              </span>
              <ChevronDown
                aria-hidden
                size={14}
                style={{
                  color: "var(--color-sidebar-text)",
                  transform: isSectionExpanded(section.category)
                    ? "rotate(0)"
                    : "rotate(-90deg)",
                  transition: "transform 140ms ease-out",
                }}
              />
            </button>

            {isSectionExpanded(section.category) && (
              <div
                className="mb-2"
                id={`nav-section-${section.category}`}
                style={{
                  marginLeft: 23,
                  borderLeft: "1px solid var(--color-sidebar-border)",
                }}
              >
                {section.items.map((item) => (
                  <NavLink
                    key={item.route}
                    to={item.route}
                    className={({ isActive }) =>
                      `press-feedback flex items-baseline gap-3 py-1.5 pl-4 pr-4 ${
                        isActive ? "bg-sidebar-hover" : "hover:bg-sidebar-hover"
                      }`
                    }
                    style={({ isActive }) => ({
                      boxShadow: isActive ? `inset -3px 0 ${section.accent}` : undefined,
                    })}
                  >
                    {({ isActive }) => (
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: isActive ? 700 : 400,
                          color: isActive
                            ? "var(--color-sidebar-active)"
                            : "var(--color-sidebar-text)",
                        }}
                      >
                        {item.label}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `press-feedback flex items-center gap-3 px-4 py-3 hover:bg-sidebar-hover ${
              isActive ? "bg-sidebar-hover" : ""
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Settings size={13} style={{ color: "var(--color-sidebar-text)" }} />
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: 0,
                  textTransform: "uppercase",
                  fontWeight: isActive ? 700 : 600,
                  color: isActive
                    ? "var(--color-sidebar-active)"
                    : "var(--color-sidebar-text)",
                }}
              >
                Settings
              </span>
            </>
          )}
        </NavLink>
      </div>
    </aside>
  );
}
