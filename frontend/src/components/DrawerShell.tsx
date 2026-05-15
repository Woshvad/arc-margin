import { useEffect, type ReactNode } from "react";

interface DrawerShellProps {
  open: boolean;
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function DrawerShell({ open, eyebrow, title, onClose, children, className = "" }: DrawerShellProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, open]);

  if (!open) return null;

  const closeFromBackdrop = () => {
    if (window.matchMedia("(min-width: 721px)").matches) onClose();
  };

  return (
    <div className="drawer-layer" role="presentation">
      <button className="drawer-backdrop" aria-label="Close drawer backdrop" onClick={closeFromBackdrop} />
      <aside className={`drawer-panel ${className}`} role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-header">
          <div>
            <div className="section-num">{eyebrow}</div>
            <h2 id="drawer-title" className="drawer-title">
              {title}
            </h2>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close drawer">
            Close
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}
