const steps = [
  { title: "Market shock hits", desc: "Spot drifts and perp funding turns against the riskiest account." },
  { title: "Buffer falls", desc: "Liquidation buffer crosses the policy floor on at least one position." },
  { title: "Agent evaluates", desc: "The backend chooses top-up, block, deleverage, hedge, or hold." },
  { title: "Policy decides", desc: "PolicyContract.evaluateAction() approves or blocks the action on Arc testnet." },
  { title: "Arc receipt", desc: "A tx hash appears when the backend broadcast succeeds." },
];

export function DemoFlow({
  active,
  loading,
  running,
  error,
  highlighted,
  onShock,
  onRunCycle,
  onStartDemo,
}: {
  active: number;
  loading: boolean;
  running: boolean;
  error: string | null;
  highlighted: boolean;
  onShock: () => void;
  onRunCycle: () => void;
  onStartDemo: () => void;
}) {
  return (
    <section id="sec-demo" className={"section wrap" + (highlighted ? " section-highlight" : "")} data-screen-label="Demo Flow">
      <hr className="dotted" />
      <div className="section-header" style={{ marginTop: 36 }}>
        <div>
          <div className="section-num">// 05 - Demo Flow</div>
          <h2 className="display section-title" style={{ marginTop: 12 }}>
            Ten <span className="accent">seconds.</span> Five steps.
          </h2>
        </div>
        <div className="section-kicker">
          Backend-first demo sequence. If Arc testnet or the API stalls, the step stays honest and fallback output is labeled.
        </div>
        <div className="section-actions">
          <button className="pill outline" onClick={onShock} disabled={running}>
            Trigger Shock
          </button>
          <button className="pill outline" onClick={onRunCycle} disabled={running}>
            Run Cycle
          </button>
          <button className="pill gold" onClick={onStartDemo} disabled={running}>
            {running ? "Demo Running" : "Start Demo Mode"}
          </button>
        </div>
      </div>

      <div className="demo-strip">
        {steps.map((step, index) => {
          const stateClass = active === index ? (loading ? " loading" : " active") : running && active > index ? " complete" : "";
          return (
            <div key={step.title} className={"demo-step" + stateClass}>
              <div className="demo-step-num">{String(index + 1).padStart(2, "0")}</div>
              <div className="demo-step-title">{step.title}</div>
              <div className="demo-step-desc">{step.desc}</div>
              {index < steps.length - 1 && <div className="demo-arrow">-&gt;</div>}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="honest demo-error">
          <div className="honest-mark">!</div>
          <div className="honest-text">
            <b>Demo fallback:</b> {error}
          </div>
        </div>
      )}
    </section>
  );
}
