"use client";

import { useEffect, useState } from "react";

/** Renders a QR code as inline SVG (transparent background, brand-green modules). */
export default function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let cancelled = false;
    import("qrcode").then((QR) => QR.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0a2418", light: "#0000" } }))
      .then((out) => { if (!cancelled) setSvg(out); })
      .catch(() => { if (!cancelled) setSvg(""); });
    return () => { cancelled = true; };
  }, [value]);
  return <div className={className} role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}
