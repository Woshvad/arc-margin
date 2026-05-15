import { useMemo, useState } from "react";
import { ArcLayer } from "./components/ArcLayer";
import { DemoFlow } from "./components/DemoFlow";
import { Hero } from "./components/Hero";
import { Marquee } from "./components/Marquee";
import { Nav } from "./components/Nav";
import { PolicySection } from "./components/PolicySection";
import { ReceiptTrail } from "./components/ReceiptTrail";
import { RiskCommandCenter } from "./components/RiskCommandCenter";
import { VenueAdapters } from "./components/VenueAdapters";
import { useAgentAPI, useAgentActions } from "./hooks/useAgentAPI";
import { portfolioStats, weakestPosition } from "./lib/risk";
import { useStore } from "./store/useStore";

export default function App() {
  useAgentAPI();
  const actions = useAgentActions();
  const [section, setSection] = useState("Dashboard");

  const state = useStore((store) => store.state);
  const connectionMode = useStore((store) => store.connectionMode);
  const pendingAction = useStore((store) => store.pendingAction);
  const selectedReceipt = useStore((store) => store.selectedReceipt);
  const setSelectedReceipt = useStore((store) => store.setSelectedReceipt);
  const demoStep = useStore((store) => store.demoStep);
  const policyExportStatus = useStore((store) => store.policyExportStatus);

  const stats = useMemo(() => portfolioStats(state), [state]);
  const weakest = useMemo(() => weakestPosition(state.positions), [state.positions]);

  return (
    <>
      <Nav section={section} setSection={setSection} onRunCycle={actions.runCycle} connectionMode={connectionMode} />

      <Hero
        state={state}
        stats={stats}
        weakest={weakest}
        connectionMode={connectionMode}
        onRunCycle={actions.runCycle}
        onShock={actions.runShock}
      />

      <RiskCommandCenter
        state={state}
        stats={stats}
        weakest={weakest}
        onShock={actions.runShock}
        onRunCycle={actions.runCycle}
        onReset={actions.reset}
      />

      <PolicySection
        state={state}
        pendingAction={pendingAction}
        exportStatus={policyExportStatus}
        onProfile={actions.setProfile}
        onAutoHedge={actions.setAutoHedge}
        onPaused={actions.setPaused}
        onAutopilot={actions.setAutopilot}
        onExport={actions.exportPolicy}
      />

      <ArcLayer state={state} />

      <ReceiptTrail
        state={state}
        selectedReceipt={selectedReceipt}
        onDetails={setSelectedReceipt}
        onCloseDetails={() => setSelectedReceipt(null)}
      />

      <DemoFlow active={demoStep} onShock={actions.runShock} onRunCycle={actions.runCycle} />

      <VenueAdapters state={state} />

      <Marquee />

      <footer className="footer">
        <div className="wrap">
          <div className="footer-inner">
            <div>
              <div className="footer-brand-name">
                Arc<span className="accent">Margin</span>
              </div>
              <div className="footer-tag">
                Arc testnet liquidation protection with real policy receipts, Circle wallet signing, and honest simulated venue adapters.
              </div>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Product</div>
              <ul>
                <li><a href="#sec-dashboard">Risk Command Center</a></li>
                <li><a href="#sec-policy">Policy Contract</a></li>
                <li><a href="#sec-arc-layer">Arc Layer</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Stack</div>
              <ul>
                <li><a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">Arc Testnet</a></li>
                <li><a href="https://www.circle.com/" target="_blank" rel="noreferrer">Circle Wallets</a></li>
                <li><a href="https://rpc.testnet.arc.network" target="_blank" rel="noreferrer">USDC Gas</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Demo</div>
              <ul>
                <li><a className="button-link" onClick={(event) => { event.preventDefault(); void actions.runCycle(); }}>Run Agent Cycle</a></li>
                <li><a className="button-link" onClick={(event) => { event.preventDefault(); void actions.runShock(); }}>Simulate Shock</a></li>
                <li><a className="button-link" onClick={(event) => { event.preventDefault(); void actions.reset(); }}>Reset Scenario</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>ArcMargin - v0.1 testnet</span>
            <span>{state.chain.name} - {state.policy.contractAddress} - {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </>
  );
}
