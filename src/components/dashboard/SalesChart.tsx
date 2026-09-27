"use client";

import { useEffect, useRef, useState } from "react";

import { formatLKR } from "@/lib/money";

export interface ChartBucket {
  key: string;
  label: string;
  revenue: number;
  profit: number;
  invoices: number;
}

const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 52 };

/** "LKR 1.2M" / "450k" - short enough for an axis. Rupees in, cents stored. */
function short(cents: number): string {
  const r = cents / 100;
  if (r >= 1_000_000) return `${(r / 1_000_000).toFixed(r >= 10_000_000 ? 0 : 1)}M`;
  if (r >= 1_000) return `${Math.round(r / 1_000)}k`;
  return String(Math.round(r));
}

/** A round top value for the axis, so gridlines land on tidy numbers. */
function niceMax(v: number): number {
  if (v <= 0) return 100_00;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

/**
 * Sales per day (or month) as bars, one series. Hover or tab onto a bar for the
 * exact figures. Laid out in real pixels from the container width so text and
 * the rounded bar ends never stretch.
 */
export default function SalesChart({
  buckets,
  unit,
}: {
  buckets: ChartBucket[];
  unit: "day" | "month";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = niceMax(Math.max(0, ...buckets.map((b) => b.revenue)));
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = buckets.length > 0 ? plotW / buckets.length : 0;
  const gap = 2; // surface gap between adjacent bars
  const barW = Math.max(1, Math.min(28, slot - gap));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  // Label only as many dates as fit, so they never collide.
  const every = Math.max(1, Math.ceil(buckets.length / Math.max(1, Math.floor(plotW / 56))));

  const hovered = active !== null ? buckets[active] : null;

  return (
    <div ref={wrapRef} className="relative w-full">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Sales per ${unit}`}
          onMouseLeave={() => setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-slate-500 text-[11px]"
              >
                {short(t)}
              </text>
            </g>
          ))}

          {buckets.map((b, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const h = Math.max(0, y(0) - y(b.revenue));
            const r = Math.min(4, barW / 2, h);
            const x0 = cx - barW / 2;
            const top = y(0) - h;
            // Rounded top corners only; square to the baseline.
            const path =
              h === 0
                ? ""
                : `M${x0},${y(0)} V${top + r} Q${x0},${top} ${x0 + r},${top} ` +
                  `H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${y(0)} Z`;
            return (
              <g key={b.key}>
                {path && (
                  <path
                    d={path}
                    className={
                      active === null || active === i
                        ? "fill-[#2a78d6] dark:fill-[#3987e5]"
                        : "fill-[#2a78d6]/40 dark:fill-[#3987e5]/40"
                    }
                  />
                )}
                {/* Hit target: the whole column, far bigger than a thin bar. */}
                <rect
                  x={PAD.left + slot * i}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${b.label}: ${formatLKR(b.revenue)} sales, ${b.invoices} invoices`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="cursor-default outline-none"
                />
                {i % every === 0 && (
                  <text
                    x={cx}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className="fill-slate-500 text-[11px]"
                  >
                    {b.label}
                  </text>
                )}
              </g>
            );
          })}

          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(0)}
            y2={y(0)}
            className="stroke-slate-300 dark:stroke-slate-700"
            strokeWidth={1}
          />
        </svg>
      )}

      {hovered && active !== null && (
        <div
          className="pointer-events-none absolute z-10 w-48 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
          style={{
            left: Math.min(
              Math.max(0, PAD.left + slot * active + slot / 2 - 96),
              Math.max(0, width - 192),
            ),
            top: 0,
          }}
        >
          <p className="font-medium text-slate-900 dark:text-slate-100">{hovered.label}</p>
          <p className="mt-1 flex justify-between text-slate-600 dark:text-slate-300">
            <span>Sales</span>
            <span className="font-mono">{formatLKR(hovered.revenue)}</span>
          </p>
          <p className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Profit</span>
            <span className="font-mono">{formatLKR(hovered.profit)}</span>
          </p>
          <p className="flex justify-between text-slate-500">
            <span>Invoices</span>
            <span className="font-mono">{hovered.invoices}</span>
          </p>
        </div>
      )}
    </div>
  );
}
