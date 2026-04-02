"use client";

import { useRef, useState } from "react";
import { Transaction } from "@/lib/api";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR");
}

interface Props {
  transaction: Transaction;
  onEdit: () => void;
  onDelete: () => void;
  pending?: boolean;
}

export default function TransactionCard({ transaction: tx, onEdit, onDelete, pending }: Props) {
  const [swipeX, setSwipeX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const directionLocked = useRef<"horizontal" | "vertical" | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    directionLocked.current = null;
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (!directionLocked.current) {
      if (Math.abs(dx) > Math.abs(dy) + 5) {
        directionLocked.current = "horizontal";
      } else if (Math.abs(dy) > Math.abs(dx) + 5) {
        directionLocked.current = "vertical";
      }
    }

    if (directionLocked.current === "horizontal") {
      const offset = revealed ? dx - 80 : dx;
      setSwipeX(Math.max(-80, Math.min(0, offset)));
    }
  }

  function handleTouchEnd() {
    if (directionLocked.current === "horizontal") {
      if (swipeX < -40) {
        setSwipeX(-80);
        setRevealed(true);
      } else {
        setSwipeX(0);
        setRevealed(false);
      }
    }
  }

  function handleClose() {
    setSwipeX(0);
    setRevealed(false);
  }

  return (
    <div
      className="relative overflow-hidden"
      onClick={revealed ? handleClose : undefined}
    >
      {/* Botões de ação atrás do card */}
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          onClick={(e) => { e.stopPropagation(); handleClose(); onEdit(); }}
          className="h-full px-4 bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-colors"
          title="Editar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleClose(); onDelete(); }}
          className="h-full px-4 bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
          title="Remover"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Card principal */}
      <div
        className={`relative bg-white dark:bg-slate-900 px-4 py-3.5 flex items-center gap-3 transition-transform select-none ${pending ? "opacity-40 pointer-events-none" : ""}`}
        style={{ transform: `translateX(${swipeX}px)`, transition: directionLocked.current === "horizontal" ? "none" : "transform 0.2s ease" }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className={`w-1 h-10 rounded-full shrink-0 ${tx.type === "income" ? "bg-emerald-400" : "bg-red-400"}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{tx.description}</p>
            <span className={`text-sm font-bold tabular-nums shrink-0 ${tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
              {tx.type === "income" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-slate-400 dark:text-slate-500">{formatDate(tx.date)}</span>
            {tx.category?.name && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700">
                {tx.category.name}
              </span>
            )}
            {pending && (
              <span className="text-xs text-amber-500 font-medium">A ser removido...</span>
            )}
          </div>
        </div>

        {/* Indicador de swipe */}
        <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
