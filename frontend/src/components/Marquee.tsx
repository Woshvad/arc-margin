export function Marquee() {
  const items = ["Stay Solvent", "Margin Never Sleeps", "Keep The Trade Alive", "Autonomous Margin Defense", "Arc Testnet Receipts"];

  return (
    <div className="marquee">
      <div className="marquee-track">
        {[0, 1].map((copy) => (
          <span key={copy}>
            {items.map((item) => (
              <span key={`${copy}-${item}`}>
                {item}
                <span className="dot" />
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
