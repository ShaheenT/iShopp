"use client";

import { useRef, useState } from "react";

export default function SnapScan() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready to capture");

  function capture(file?: File) {
    if (!file) return;
    setFileName(file.name);
    setStatus("Capture ready — price details come next");
  }

  return (
    <section className="snap-scan" aria-labelledby="snap-scan-title">
      <div className="snap-scan-copy">
        <p className="eyebrow">SNAP / SCAN</p>
        <h2 id="snap-scan-title">Turn what you see into useful shopping intelligence.</h2>
        <p>Capture the product or shelf price. iShopp will use the evidence as the starting point for a verified community contribution.</p>
        <button className="primary-button" type="button" onClick={() => inputRef.current?.click()}>Capture a price</button>
        <input ref={inputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(e) => capture(e.target.files?.[0])} />
        <p className="capture-status" role="status">{status}{fileName ? ` · ${fileName}` : ""}</p>
      </div>
      <div className="scan-frame" aria-hidden="true">
        <div className="scan-corner top-left" />
        <div className="scan-corner top-right" />
        <div className="scan-corner bottom-left" />
        <div className="scan-corner bottom-right" />
        <div className="scan-line" />
        <span>PRODUCT / PRICE</span>
      </div>
    </section>
  );
}
