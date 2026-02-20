"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Category,
  Transaction,
  TransactionFilters,
  TransactionSummary,
  categoriesApi,
  transactionsApi,
} from "@/lib/api";
import TransactionModal from "@/components/TransactionModal";
import CategoryModal from "@/components/CategoryModal";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR");
}

type Tab = "transactions" | "categories";

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [userName, setUserName] = useState("");
  const [tab, setTab] = useState<Tab>("transactions");
  const [darkMode, setDarkMode] = useState(false);

  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const filtersRef = useRef<TransactionFilters>({});
  const [txModal, setTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txLoading, setTxLoading] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catLoading, setCatLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }
    const user = localStorage.getItem("user");
    if (user) {
      try {
        setUserName(JSON.parse(user).name);
      } catch {
        // ignora erro de parse
      }
    }
    // Lê a preferência de tema salva
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(saved === "dark" || (!saved && prefersDark));
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    fetchTransactions({});
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function fetchTransactions(f: TransactionFilters) {
    setTxLoading(true);
    try {
      const data = await transactionsApi.list(f);
      setSummary(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("unauthorized") || msg.includes("401")) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.replace("/login");
      }
    } finally {
      setTxLoading(false);
    }
  }

  async function fetchCategories() {
    setCatLoading(true);
    try {
      const data = await categoriesApi.list();
      setCategories(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("unauthorized")) {
        router.replace("/login");
      }
    } finally {
      setCatLoading(false);
    }
  }

  function updateFilters(next: TransactionFilters) {
    filtersRef.current = next;
    setFilters(next);
    fetchTransactions(next);
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.replace("/login");
  }

  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  async function handleDeleteTransaction(id: string) {
    if (!confirm("Remover esta movimentação?")) return;
    await transactionsApi.remove(id);
    fetchTransactions(filtersRef.current);
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm("Remover esta categoria?")) return;
    await categoriesApi.remove(id);
    fetchCategories();
  }

  if (!ready) return null;

  const userInitial = userName ? userName.charAt(0).toUpperCase() : "U";

  // Dados para o gráfico SVG
  const chartH = 72;
  const barW = 44;
  const gap = 20;
  const maxVal = summary
    ? Math.max(summary.totalIncome, summary.totalExpense, 1)
    : 1;
  const incomeH = summary
    ? Math.max((summary.totalIncome / maxVal) * chartH, summary.totalIncome > 0 ? 4 : 0)
    : 0;
  const expenseH = summary
    ? Math.max((summary.totalExpense / maxVal) * chartH, summary.totalExpense > 0 ? 4 : 0)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FF640F] flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm tracking-tight">
              Finanças Pessoais
            </span>
          </div>

          <div className="flex items-center gap-2">
            {userName && (
              <div className="flex items-center gap-2 mr-1">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                  {userInitial}
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-300 hidden sm:block">
                  {userName}
                </span>
              </div>
            )}

            {/* Toggle dark mode */}
            <button
              onClick={toggleDarkMode}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              title={darkMode ? "Modo claro" : "Modo escuro"}
            >
              {darkMode ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:block">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Receitas */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Receitas</p>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {summary ? formatCurrency(summary.totalIncome) : "R$ 0,00"}
            </p>
            {summary && (summary.totalIncome > 0 || summary.totalExpense > 0) && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                {summary.totalIncome > 0
                  ? `${((summary.totalIncome / (summary.totalIncome + summary.totalExpense)) * 100).toFixed(0)}% do fluxo total`
                  : "Nenhuma receita"}
              </p>
            )}
          </div>

          {/* Despesas */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Despesas</p>
              <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-red-500 dark:text-red-400">
              {summary ? formatCurrency(summary.totalExpense) : "R$ 0,00"}
            </p>
            {summary && (summary.totalIncome > 0 || summary.totalExpense > 0) && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                {summary.totalExpense > 0
                  ? `${((summary.totalExpense / (summary.totalIncome + summary.totalExpense)) * 100).toFixed(0)}% do fluxo total`
                  : "Nenhuma despesa"}
              </p>
            )}
          </div>

          {/* Saldo */}
          <div className={`rounded-2xl border p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${
            !summary || summary.balance >= 0
              ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Saldo</p>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                !summary || summary.balance >= 0
                  ? "bg-emerald-100 dark:bg-emerald-900/40"
                  : "bg-red-100 dark:bg-red-900/40"
              }`}>
                <svg className={`w-4 h-4 ${!summary || summary.balance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p className={`text-2xl font-bold ${!summary || summary.balance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {summary ? formatCurrency(summary.balance) : "R$ 0,00"}
            </p>
            {summary && summary.balance !== 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                {summary.balance >= 0 ? "Fluxo positivo" : "Fluxo negativo"}
              </p>
            )}
          </div>
        </div>

        {/* Gráfico SVG — visão geral */}
        {summary && (summary.totalIncome > 0 || summary.totalExpense > 0) && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm transition-colors duration-300">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-5">
              Visão geral
            </p>
            <div className="flex items-end gap-6 sm:gap-10">
              {/* Barras SVG */}
              <svg
                width={barW * 2 + gap + 8}
                height={chartH + 32}
                className="overflow-visible shrink-0"
              >
                {/* Barra receitas */}
                <rect
                  x={0}
                  y={chartH - incomeH}
                  width={barW}
                  height={incomeH}
                  rx={6}
                  fill="#10b981"
                  opacity={0.85}
                />
                {/* Barra despesas */}
                <rect
                  x={barW + gap}
                  y={chartH - expenseH}
                  width={barW}
                  height={expenseH}
                  rx={6}
                  fill="#ef4444"
                  opacity={0.85}
                />
                <text x={barW / 2} y={chartH + 18} textAnchor="middle" fontSize={10} fill="#94a3b8">
                  Receitas
                </text>
                <text x={barW + gap + barW / 2} y={chartH + 18} textAnchor="middle" fontSize={10} fill="#94a3b8">
                  Despesas
                </text>
              </svg>

              {/* Legenda */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">Receitas</span>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(summary.totalIncome)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">Despesas</span>
                  </div>
                  <span className="text-sm font-semibold text-red-500 dark:text-red-400">
                    {formatCurrency(summary.totalExpense)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Saldo</span>
                  <span className={`text-sm font-bold ${summary.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                    {formatCurrency(summary.balance)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700 rounded-xl p-1 w-fit transition-colors duration-300">
          <button
            onClick={() => setTab("transactions")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "transactions"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Movimentações
          </button>
          <button
            onClick={() => setTab("categories")}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "categories"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Categorias
          </button>
        </div>

        {/* Transactions tab */}
        {tab === "transactions" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <select
                  value={filters.type || ""}
                  onChange={(e) =>
                    updateFilters({
                      ...filtersRef.current,
                      type: (e.target.value as "income" | "expense") || undefined,
                    })
                  }
                  className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400/40 shadow-sm"
                >
                  <option value="">Todos os tipos</option>
                  <option value="income">Receitas</option>
                  <option value="expense">Despesas</option>
                </select>

                <select
                  value={filters.categoryId || ""}
                  onChange={(e) =>
                    updateFilters({
                      ...filtersRef.current,
                      categoryId: e.target.value || undefined,
                    })
                  }
                  className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400/40 shadow-sm"
                >
                  <option value="">Todas as categorias</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={filters.startDate || ""}
                  onChange={(e) =>
                    updateFilters({ ...filtersRef.current, startDate: e.target.value || undefined })
                  }
                  className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400/40 shadow-sm"
                />
                <input
                  type="date"
                  value={filters.endDate || ""}
                  onChange={(e) =>
                    updateFilters({ ...filtersRef.current, endDate: e.target.value || undefined })
                  }
                  className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400/40 shadow-sm"
                />
              </div>

              <button
                onClick={() => {
                  setEditingTx(null);
                  setTxModal(true);
                }}
                className="flex items-center gap-2 bg-[#FF640F] hover:bg-orange-500 active:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm shadow-orange-500/20"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nova movimentação
              </button>
            </div>

            {/* Tabela */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm transition-colors duration-300">
              {txLoading ? (
                <div className="py-20 text-center">
                  <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">Carregando...</p>
                </div>
              ) : !summary || summary.transactions.length === 0 ? (
                <div className="py-20 text-center">
                  <svg
                    className="w-20 h-20 mx-auto mb-4 text-slate-200 dark:text-slate-700"
                    style={{ animation: "float 3s ease-in-out infinite" }}
                    viewBox="0 0 80 80"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect x="12" y="8" width="56" height="64" rx="8" fill="currentColor" />
                    <rect x="20" y="20" width="28" height="4" rx="2" fill="#94a3b8" opacity="0.5" />
                    <rect x="20" y="30" width="40" height="4" rx="2" fill="#94a3b8" opacity="0.35" />
                    <rect x="20" y="40" width="32" height="4" rx="2" fill="#94a3b8" opacity="0.25" />
                    <circle cx="58" cy="60" r="14" fill="#FF640F" opacity="0.9" />
                    <path d="M54 60h8M58 56v8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Nenhuma movimentação encontrada
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 max-w-[220px] mx-auto leading-relaxed">
                    Clique em &quot;Nova movimentação&quot; para começar a registrar
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Descrição
                      </th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                        Categoria
                      </th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">
                        Data
                      </th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                        Tipo
                      </th>
                      <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-5 py-3.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {summary.transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition group"
                        style={{
                          borderLeft: `3px solid ${tx.type === "income" ? "#10b981" : "#ef4444"}`,
                        }}
                      >
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {tx.description}
                          </div>
                          {tx.notes && (
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[200px]">
                              {tx.notes}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 hidden sm:table-cell">
                          {tx.category?.name ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium">
                              {tx.category.name}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-sm hidden md:table-cell">
                          {formatDate(tx.date)}
                        </td>
                        <td className="px-5 py-4 hidden sm:table-cell">
                          {tx.type === "income" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                              </svg>
                              Receita
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                              </svg>
                              Despesa
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`text-base font-bold ${tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                            {tx.type === "income" ? "+" : "-"}
                            {formatCurrency(Number(tx.amount))}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={() => {
                                setEditingTx(tx);
                                setTxModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition"
                              title="Editar"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                              title="Remover"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Categories tab */}
        {tab === "categories" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setEditingCat(null);
                  setCatModal(true);
                }}
                className="flex items-center gap-2 bg-[#FF640F] hover:bg-orange-500 active:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm shadow-orange-500/20"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nova categoria
              </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm transition-colors duration-300">
              {catLoading ? (
                <div className="py-20 text-center">
                  <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">Carregando...</p>
                </div>
              ) : categories.length === 0 ? (
                <div className="py-20 text-center">
                  <svg
                    className="w-20 h-20 mx-auto mb-4 text-slate-200 dark:text-slate-700"
                    style={{ animation: "float 3s ease-in-out infinite" }}
                    viewBox="0 0 80 80"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect x="8" y="28" width="64" height="40" rx="8" fill="currentColor" />
                    <path d="M8 36h64" stroke="#94a3b8" strokeWidth="2" opacity="0.4" />
                    <rect x="18" y="44" width="20" height="4" rx="2" fill="#94a3b8" opacity="0.4" />
                    <rect x="18" y="54" width="32" height="4" rx="2" fill="#94a3b8" opacity="0.3" />
                    <path d="M24 28V20a16 16 0 0132 0v8" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
                    <circle cx="60" cy="60" r="14" fill="#FF640F" opacity="0.9" />
                    <path d="M56 60h8M60 56v8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Nenhuma categoria cadastrada
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 max-w-[220px] mx-auto leading-relaxed">
                    Crie categorias para organizar melhor suas movimentações
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                  {categories.map((cat) => (
                    <li
                      key={cat.id}
                      className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 flex items-center justify-center shrink-0 text-base">
                          {cat.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-200">{cat.name}</p>
                          {cat.description && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              {cat.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => {
                            setEditingCat(cat);
                            setCatModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition"
                          title="Editar"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                          title="Remover"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>

      <TransactionModal
        open={txModal}
        onClose={() => setTxModal(false)}
        onSaved={() => fetchTransactions(filtersRef.current)}
        categories={categories}
        editing={editingTx}
      />

      <CategoryModal
        open={catModal}
        onClose={() => setCatModal(false)}
        onSaved={fetchCategories}
        editing={editingCat}
      />
    </div>
  );
}
