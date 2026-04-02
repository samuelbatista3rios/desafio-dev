"use client";

import { useState } from "react";
import { Goal, goalsApi } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onDeposited: () => void;
  onSuccess: (msg: string) => void;
  goal: Goal | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function GoalDepositModal({ open, onClose, onDeposited, onSuccess, goal }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !goal) return null;

  const remaining = Math.max(0, Number(goal.targetAmount) - Number(goal.currentAmount));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal) return;
    const val = Number(amount);
    if (!val || val <= 0) {
      setError("Informe um valor positivo");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await goalsApi.deposit(goal.id, val);
      onSuccess(`${formatCurrency(val)} adicionado à meta!`);
      onDeposited();
      setAmount("");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao depositar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm z-10" style={{ animation: "modal-in 0.2s ease-out" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Depositar na meta</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{goal.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
            <span>Atual: <span className="font-semibold text-slate-600 dark:text-slate-300">{formatCurrency(Number(goal.currentAmount))}</span></span>
            <span>Faltam: <span className="font-semibold text-orange-500">{formatCurrency(remaining)}</span></span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
              Valor a adicionar (R$)
            </label>
            <input
              type="number"
              required
              min={0.01}
              step={0.01}
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 dark:focus:border-orange-500 transition"
              autoFocus
            />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition disabled:opacity-60"
            >
              {loading ? "Depositando..." : "Depositar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
