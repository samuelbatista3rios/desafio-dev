"use client";

import { useEffect, useState } from "react";
import {
  Category,
  Transaction,
  CreateTransactionPayload,
  transactionsApi,
} from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onSuccess: (msg: string) => void;
  categories: Category[];
  editing?: Transaction | null;
}

const emptyForm: CreateTransactionPayload = {
  description: "",
  amount: 0,
  type: "expense",
  date: new Date().toISOString().split("T")[0],
  notes: "",
  categoryId: "",
};

export default function TransactionModal({
  open,
  onClose,
  onSaved,
  onSuccess,
  categories,
  editing,
}: Props) {
  const [form, setForm] = useState<CreateTransactionPayload>(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        description: editing.description,
        amount: Number(editing.amount),
        type: editing.type,
        date: editing.date.split("T")[0],
        notes: editing.notes || "",
        categoryId: editing.categoryId || "",
      });
    } else {
      setForm(emptyForm);
    }
    setError("");
  }, [editing, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload = {
      ...form,
      amount: Number(form.amount),
      categoryId: form.categoryId || undefined,
      notes: form.notes || undefined,
    };

    try {
      if (editing) {
        await transactionsApi.update(editing.id, payload);
        onSuccess("Movimentação atualizada com sucesso!");
      } else {
        await transactionsApi.create(payload);
        onSuccess("Movimentação criada com sucesso!");
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden">
      
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {editing ? "Editar movimentação" : "Nova movimentação"}
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {editing ? "Altere os dados abaixo" : "Preencha os dados da movimentação"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-xl px-4 py-3 text-sm">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

      
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "expense" })}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition ${
                form.type === "expense"
                  ? "bg-red-500 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "income" })}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition ${
                form.type === "income"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
              Receita
            </button>
          </div>

  
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Descrição <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-600/50 rounded-xl text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900/60 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 dark:focus:border-orange-500/50 transition"
              placeholder="Ex: Aluguel, Salário, Mercado..."
            />
          </div>

   
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Valor (R$) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={form.amount || ""}
                onChange={(e) =>
                  setForm({ ...form, amount: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-600/50 rounded-xl text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900/60 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 dark:focus:border-orange-500/50 transition"
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Data <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-600/50 rounded-xl text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900/60 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 dark:focus:border-orange-500/50 transition"
              />
            </div>
          </div>

 
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Categoria{" "}
              <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">(opcional)</span>
            </label>
            {categories.length === 0 ? (
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/50 rounded-xl">
                <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Crie uma categoria na aba <span className="font-medium text-slate-500 dark:text-slate-400">Categorias</span> para associar
                </p>
              </div>
            ) : (
              <select
                value={form.categoryId || ""}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-600/50 rounded-xl text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900/60 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 dark:focus:border-orange-500/50 transition"
              >
                <option value="">Sem categoria</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Observações{" "}
              <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">(opcional)</span>
            </label>
            <textarea
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-600/50 rounded-xl text-sm text-slate-800 dark:text-white bg-white dark:bg-slate-900/60 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 dark:focus:border-orange-500/50 transition resize-none"
              placeholder="Algum detalhe adicional..."
            />
          </div>

    
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[#FF640F] hover:bg-orange-500 text-white rounded-xl text-sm font-medium transition shadow-sm shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
