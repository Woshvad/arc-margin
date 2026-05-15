import type { ConnectionMode } from "../store/useStore";

interface NavProps {
  section: string;
  setSection: (section: string) => void;
  onRunCycle: () => void;
  connectionMode: ConnectionMode;
}

const items = ["Dashboard", "Policy", "Arc Layer", "Demo"];

function label(mode: ConnectionMode): string {
  if (mode === "live") return "Arc Testnet - Live";
  if (mode === "reconnecting") return "Reconnecting";
  return "Demo Mode";
}

export function Nav({ section, setSection, onRunCycle, connectionMode }: NavProps) {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-brand">
          <div className="nav-brand-mark" />
          ArcMargin
        </div>
        {items.map((item) => (
          <button
            key={item}
            className={"pill" + (section === item ? " is-active" : "")}
            onClick={() => {
              setSection(item);
              const id = "sec-" + item.toLowerCase().replace(" ", "-");
              const el = document.getElementById(id);
              if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
            }}
          >
            {item}
          </button>
        ))}
        <div className="nav-status">
          <span className={`mode-badge ${connectionMode}`}>{label(connectionMode)}</span>
          <button className="pill gold nav-actions-desktop" onClick={onRunCycle}>
            Run Agent Cycle
          </button>
        </div>
      </div>
    </nav>
  );
}
