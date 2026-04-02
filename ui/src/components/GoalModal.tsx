"use client";

import { useEffect, useState } from "react";
import { Goal, CreateGoalPayload, goalsApi } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onSuccess: (msg: string) => void;
  editing?: Goal | null;
}

const emptyForm: CreateGoalPayload = {
  name: "",
  targetAmount: 0,
  currentAmount: 0,
  deadline: "",
};

export default function GoalModal({ open, onClose, onSaved, onSuccess, editing }: Props) {
  const [form, setForm] = useState<CreateGoalPayload>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          name: editing.name,
          targetAmount: Number(editing.targetAmount),
          currentAmount: Number(editing.currentAmount),
          deadline: editing.deadline ? editing.deadline.split("T")[0] : "",
        });
      } else {
        setForm(emptyForm);
      }
      setError(null);
    }
  }, [open, editing]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: CreateGoalPayload = {
        name: form.name,
        targetAmount: Number(form.targetAmount),
        currentAmount: Number(form.currentAmount ?? 0),
        deadline: form.deadline || undefined,
      };
      if (editing) {
        await goalsApi.update(editing.id, payload);
        onSuccess("Meta atualizada com sucesso!");
      } else {
        await goalsApi.create(payload);
        onSuccess("Meta criada com sucesso!");
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar meta");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 dark:focus:border-orange-500 transition";
  const labelClass = "block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md z-10" style={{ animation: "modal-in 0.2s ease-out" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {editing ? "Editar meta" : "Nova meta"}
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className={labelClass}>Nome da meta</label>
            <input
              type="text"
              required
              placeholder="Ex: Viagem para Europa"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Valor alvo (R$)</label>
            <input
              type="number"
              required
              min={0.01}
              step={0.01}
              placeholder="0,00"
              value={form.targetAmount || ""}
              onChange={(e) => setForm({ ...form, targetAmount: Number(e.target.value) })}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Valor atual (R$) <span className="text-slate-400 font-normal normal-case">(opcional)</span></label>
            <input
              type="number"
              min={0}
              step={0.01}
              placeholder="0,00"
              value={form.currentAmount || ""}
              onChange={(e) => setForm({ ...form, currentAmount: Number(e.target.value) })}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Prazo <span className="text-slate-400 font-normal normal-case">(opcional)</span></label>
            <input
              type="date"
              value={form.deadline || ""}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className={inputClass}
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
              {loading ? "Salvando..." : editing ? "Salvar alterações" : "Criar meta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
