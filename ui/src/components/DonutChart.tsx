"use client";

import { useState } from "react";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: DonutSlice[];
  darkMode: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function DonutChart({ data, darkMode }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma despesa por categoria no período</p>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = 100, cy = 100, outerR = 80, innerR = 52;

  let startAngle = -Math.PI / 2;
  const slices = data.map((slice, i) => {
    const pct = slice.value / total;
    const endAngle = startAngle + pct * 2 * Math.PI;
    const largeArc = pct > 0.5 ? 1 : 0;

    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle);
    const iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle);
    const iy2 = cy + innerR * Math.sin(startAngle);

    const path = [
      `M ${x1} ${y1}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      "Z",
    ].join(" ");

    const midAngle = startAngle + (pct * Math.PI);
    startAngle = endAngle;

    return { ...slice, path, pct, midAngle, idx: i };
  });

  const hovered = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 200 200" className="w-48 h-48 sm:w-56 sm:h-56">
        {slices.map((slice) => {
          const isHovered = hoveredIdx === slice.idx;
          const scale = isHovered ? 1.05 : 1;
          return (
            <path
              key={slice.idx}
              d={slice.path}
              fill={slice.color}
              opacity={hoveredIdx !== null && !isHovered ? 0.5 : 1}
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                transform: `scale(${scale})`,
                transition: "all 0.15s ease",
                cursor: "pointer",
              }}
              onMouseEnter={() => setHoveredIdx(slice.idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          );
        })}
        {/* Texto central */}
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          fontSize="10"
          fontWeight="600"
          fill={darkMode ? "#94a3b8" : "#64748b"}
        >
          {hovered ? hovered.label : "Total"}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill={darkMode ? "#f1f5f9" : "#1e293b"}
        >
          {formatCurrency(hovered ? hovered.value : total)}
        </text>
        {hovered && (
          <text
            x={cx}
            y={cy + 24}
            textAnchor="middle"
            fontSize="9"
            fill={darkMode ? "#64748b" : "#94a3b8"}
          >
            {(hovered.pct * 100).toFixed(1)}%
          </text>
        )}
      </svg>

      {/* Legenda */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 px-2">
        {slices.map((slice) => (
          <div
            key={slice.idx}
            className="flex items-center gap-1.5 cursor-pointer"
            onMouseEnter={() => setHoveredIdx(slice.idx)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
            <span className="text-xs text-slate-500 dark:text-slate-400">{slice.label}</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {(slice.pct * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
