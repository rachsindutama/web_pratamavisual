import React, { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * LOADING STATE — pixel-grid loader for long-running work
 *
 * Variants:
 *   Drive  — square cells, chevron wavefront driving right;
 *            the 650ms cycle is shorter than the sweep, so
 *            two fronts are always in flight
 *   Dots   — same wavefront, circular cells
 *   Orbit  — a comet lapping the grid perimeter
 *   Surfer — the Drive loader paired with a meme video below
 *
 * Paired with a shimmering label and a live elapsed timer
 * in mono tabular figures. Reduced motion freezes the grid
 * to its dim state; the timer still ticks.
 * ───────────────────────────────────────────────────────── */

const chevron = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3), c = i % 3;
  return (c + Math.abs(r - 1)) * 90;
});

const ORBIT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3];
const orbit = Array.from({ length: 9 }, (_, i) => {
  const k = ORBIT_ORDER.indexOf(i);
  return k === -1 ? null : k * 110;
});

const PATTERNS = {
  Drive: { delays: chevron, dur: 650, round: false },
  Dots: { delays: chevron, dur: 650, round: true },
  Orbit: { delays: orbit, dur: 950, round: false },
};

export function PixelLoader({
  variant = "Drive",
  size = 3.5,
  gap = 1.5,
  color = "var(--color-accent, #c9a96e)",
  style,
}) {
  const { delays, dur, round } = PATTERNS[variant] ?? PATTERNS.Drive;
  return (
    <span
      aria-hidden
      style={{
        display: "inline-grid",
        gridTemplateColumns: `repeat(3, ${size}px)`,
        gap: `${gap}px`,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {delays.map((delay, index) => (
        <span
          key={index}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: color,
            borderRadius: round ? "9999px" : "1px",
            opacity: delay === null ? 0.07 : 0.18,
            animation:
              delay === null
                ? "none"
                : `pixel-on ${dur}ms ease-in-out ${delay}ms infinite`,
          }}
        />
      ))}
    </span>
  );
}

export { LoaderGrid, PATTERNS };

function LoaderGrid({ delays, dur, round }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px]"
      style={{
        display: "inline-grid",
        gridTemplateColumns: "repeat(3, 4px)",
        gap: "1.5px",
        flexShrink: 0,
      }}
    >
      {delays.map((delay, index) => (
        <span
          key={index}
          className={`size-[4px] bg-ink ${round ? "rounded-full" : "rounded-[1px]"}`}
          style={{
            width: "4px",
            height: "4px",
            backgroundColor: "var(--ink, #ffffff)",
            borderRadius: round ? "9999px" : "1px",
            opacity: delay === null ? 0.07 : 0.15,
            animation:
              delay === null
                ? "none"
                : `pixel-on ${dur}ms ease-in-out ${delay}ms infinite`,
          }}
        />
      ))}
    </span>
  );
}

function useElapsed() {
  const [ds, setDs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDs((d) => d + 1), 100);
    return () => clearInterval(t);
  }, []);
  const total = ds / 10;
  if (total < 60) return `${total.toFixed(1)}s`;
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
}

export default function LoadingState({
  label,
  variant = "Drive",
  /** the meme feed for the Surfer variant; hosted on Vercel Blob so it plays in
   *  production (the local /public/subway-surfers.mp4 stays gitignored).
   *  Heavily compressed (288px, 20fps, no audio → ~265 KB, from 1.1 MB) to keep
   *  Blob data transfer down. */
  videoSrc = "https://95dnc2a95qgwt9ff.public.blob.vercel-storage.com/subway-surfers-min.mp4",
}) {
  const elapsed = useElapsed();
  const surfer = variant === "Surfer";
  const resolvedLabel = label ?? (surfer ? "Subway surfing" : "Churning");
  const [videoOk, setVideoOk] = useState(true);
  const { delays, dur, round } = PATTERNS[variant] ?? PATTERNS.Drive;

  const labelEl = (
    <span
      className="bg-clip-text text-[13px] font-medium text-transparent"
      style={{
        fontSize: "13px",
        fontWeight: 500,
        color: "transparent",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        backgroundImage:
          "linear-gradient(90deg, var(--ink-3, rgba(255,255,255,0.4)) 35%, var(--ink, #ffffff) 50%, var(--ink-3, rgba(255,255,255,0.4)) 65%)",
        backgroundSize: "200% 100%",
        animation: "shimmer-text 1.4s linear infinite",
      }}
    >
      {resolvedLabel}
    </span>
  );

  const elapsedEl = (
    <span
      className="font-mono text-[12px] text-ink-3 tabular-nums"
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: "12px",
        color: "var(--ink-3, rgba(255,255,255,0.45))",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {elapsed}
    </span>
  );

  if (surfer) {
    return (
      <div
        role="status"
        className="flex w-fit flex-col items-start"
        style={{
          display: "flex",
          width: "fit-content",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <div
          className="flex items-center gap-2.5"
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
        >
          <LoaderGrid {...PATTERNS.Drive} />
          {labelEl}
          {elapsedEl}
        </div>

        {/* the context card follows the status text it is illustrating */}
        <div
          className="mt-2 w-56 overflow-hidden rounded-[10px] shadow-overlay"
          style={{
            marginTop: "8px",
            width: "224px",
            overflow: "hidden",
            borderRadius: "10px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
            animation: "pop-in 200ms cubic-bezier(0.16,1,0.3,1) both",
            transformOrigin: "top left",
          }}
        >
          <div
            className="relative aspect-video w-full"
            style={{
              position: "relative",
              aspectRatio: "16 / 9",
              width: "100%",
              background: "var(--tooltip-bg, #1a1a1a)",
            }}
          >
            {videoOk ? (
              <video
                src={videoSrc}
                autoPlay
                muted
                loop
                playsInline
                onError={() => setVideoOk(false)}
                className="h-full w-full object-cover"
                style={{ height: "100%", width: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                className="flex h-full w-full flex-col items-center justify-center gap-1.5"
                style={{
                  display: "flex",
                  height: "100%",
                  width: "100%",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <LoaderGrid {...PATTERNS.Drive} />
                <span
                  className="px-3 text-center font-mono text-[10px]"
                  style={{
                    padding: "0 12px",
                    textAlign: "center",
                    fontFamily: "monospace",
                    fontSize: "10px",
                    color: "var(--tooltip-muted, #888888)",
                  }}
                >
                  Video unavailable
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex w-fit items-center gap-2.5"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        width: "fit-content",
        padding: "8px 14px",
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "8px",
      }}
    >
      <LoaderGrid delays={delays} dur={dur} round={round} />
      {labelEl}
      {elapsedEl}
    </div>
  );
}
