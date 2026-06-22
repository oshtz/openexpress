import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Settings } from "lucide-react";
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const section of sections) {
      initial[section.category] = location.pathname.startsWith(`/${section.category}/`);
    }
    return initial;
  });

  const toggle = (category: Category) =>
    setExpanded((prev) => ({ ...prev, [category]: !prev[category] }));

  return (
    <aside
      className="w-[240px] flex flex-col shrink-0 select-none border-r border-sidebar-border"
      style={{
        background: "var(--color-sidebar-bg)",
        color: "var(--color-sidebar-active)",
      }}
    >
      <NavLink
        to="/"
        aria-label="OpenExpress home"
        className="block px-5 pt-6 pb-6 border-b border-sidebar-border"
      >
        <div
          aria-hidden="true"
          className="w-full"
          style={{
            height: 58,
            background: "var(--color-sidebar-active)",
            WebkitMask: "url('/openexpress-logo.svg') center / contain no-repeat",
            mask: "url('/openexpress-logo.svg') center / contain no-repeat",
          }}
        />
      </NavLink>

      <nav className="flex-1 overflow-y-auto py-4">
        {sections.map((section, sIdx) => (
          <div
            key={section.category}
            className={sIdx > 0 ? "border-t border-sidebar-border" : ""}
          >
            <button
              onClick={() => toggle(section.category)}
              aria-expanded={!!expanded[section.category]}
              aria-controls={`nav-section-${section.category}`}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-sidebar-hover transition-colors"
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
                  letterSpacing: "0.08em",
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
              <span
                aria-hidden
                style={{
                  fontSize: 14,
                  color: "var(--color-sidebar-text)",
                  width: 12,
                  textAlign: "center",
                  display: "inline-block",
                  transform: expanded[section.category] ? "rotate(0)" : "rotate(-90deg)",
                  transition: "transform 100ms linear",
                }}
              >
                v
              </span>
            </button>

            {expanded[section.category] && (
              <div
                className="mb-3"
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
                      `flex items-baseline gap-3 pl-4 pr-5 py-1.5 transition-colors ${
                        isActive ? "bg-sidebar-hover" : "hover:bg-sidebar-hover"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
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
                        {isActive && (
                          <span
                            style={{
                              marginLeft: "auto",
                              color: section.accent,
                              fontSize: 14,
                              lineHeight: 1,
                            }}
                          >
                            -&gt;
                          </span>
                        )}
                      </>
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
            `flex items-center gap-3 px-5 py-4 hover:bg-sidebar-hover transition-colors ${
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
                  letterSpacing: "0.1em",
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
