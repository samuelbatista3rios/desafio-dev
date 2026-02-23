"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function getCurrentDateLabel() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type Tab = "transactions" | "categories";

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface MonthlyData {
  label: string;
  income: number;
  expense: number;
}

function formatShort(value: number): string {
  if (value >= 1_000_000) return `R$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return value === 0 ? "R$0" : `R$${value.toFixed(0)}`;
}


const CATEGORY_COLORS = [
  "from-violet-400 to-violet-600",
  "from-blue-400 to-blue-600",
  "from-cyan-400 to-cyan-600",
  "from-teal-400 to-teal-600",
  "from-emerald-400 to-emerald-600",
  "from-amber-400 to-amber-600",
  "from-rose-400 to-rose-600",
  "from-pink-400 to-pink-600",
];

function categoryGradient(name: string) {
  const idx = name.charCodeAt(0) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[idx];
}

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

  const [chartData, setChartData] = useState<MonthlyData[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [hoveredBar, setHoveredBar] = useState<{
    monthIdx: number;
    x: number;
    y: number;
    value: number;
    type: "income" | "expense";
  } | null>(null);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  }

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
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved === "dark" || (!saved && prefersDark);
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    }
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    fetchTransactions({});
    fetchCategories();
    fetchChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function fetchTransactions(f: TransactionFilters) {
    setTxLoading(true);
    try {
      const data = await transactionsApi.list(f);
      setSummary(data);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
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
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
      }
    } finally {
      setCatLoading(false);
    }
  }

  async function fetchChartData() {
    setChartLoading(true);
    try {
      const now = new Date();
      const startD = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const startDate = startD.toISOString().split("T")[0];
      const data = await transactionsApi.list({ startDate });

      const months: MonthlyData[] = [];
      for (let offset = 2; offset >= 0; offset--) {
        const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const txs = data.transactions.filter((tx) => {
          const td = new Date(tx.date.split("T")[0] + "T12:00:00");
          return td.getFullYear() === y && td.getMonth() === m;
        });
        months.push({
          label: `${MONTHS_PT[m]}/${String(y).slice(2)}`,
          income: txs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
          expense: txs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
        });
      }
      setChartData(months);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
      }
    } finally {
      setChartLoading(false);
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
  const firstName = userName.split(" ")[0];
  const total = summary ? summary.totalIncome + summary.totalExpense : 0;

  
  const maxVal = summary ? Math.max(summary.totalIncome, summary.totalExpense, 1) : 1;
  const incomeBarPercent = summary ? (summary.totalIncome / maxVal) * 100 : 0;
  const expenseBarPercent = summary ? (summary.totalExpense / maxVal) * 100 : 0;
  const expenseOfIncome = summary && summary.totalIncome > 0
    ? (summary.totalExpense / summary.totalIncome) * 100
    : 0;

  
  const flowIncomePercent = total > 0 ? (summary!.totalIncome / total) * 100 : 50;
  const flowExpensePercent = total > 0 ? (summary!.totalExpense / total) * 100 : 50;

 
  const C_PX0 = 60, C_PY0 = 32, C_PW = 444, C_PH = 144;
  const C_PY1 = C_PY0 + C_PH; 
  const C_GW = C_PW / 3; 
  const C_BW = 38, C_BG = 6;
  const C_IP = (C_GW - C_BW * 2 - C_BG) / 2; 
  const chartMaxVal = chartData.length > 0
    ? Math.max(...chartData.map((m) => Math.max(m.income, m.expense)), 1)
    : 1;
  const chartBarH = (v: number) => Math.max((v / chartMaxVal) * C_PH, v > 0 ? 3 : 0);
  const chartBarY = (v: number) => C_PY1 - chartBarH(v);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0c0e14] transition-colors duration-300">
   
      {successMsg && (
        <div
          className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900 text-slate-800 dark:text-slate-100 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium"
          style={{ animation: "slide-in-right 0.25s ease-out" }}
        >
          <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          {successMsg}
        </div>
      )}


      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-sm shadow-orange-500/30">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-slate-900 dark:text-white tracking-tight text-sm">
              FinançasPro
            </span>
          </div>


          <div className="flex items-center gap-1">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

        
            {userName && (
              <div className="flex items-center gap-2 px-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-xs font-bold text-white">
                  {userInitial}
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:block">
                  {userName}
                </span>
              </div>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors px-2.5 py-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:block">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

   
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}!
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
            {getCurrentDateLabel()}
          </p>
        </div>

      
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          <div className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-t-2xl" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Receitas</span>
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {summary ? formatCurrency(summary.totalIncome) : "R$ 0,00"}
            </p>
            <div className="mt-3">
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${incomeBarPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                {total > 0 ? "maior valor do período" : "Nenhuma movimentação"}
              </p>
            </div>
          </div>

    
          <div className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-400 to-red-600 rounded-t-2xl" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Despesas</span>
              <div className="w-9 h-9 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {summary ? formatCurrency(summary.totalExpense) : "R$ 0,00"}
            </p>
            <div className="mt-3">
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all duration-700"
                  style={{ width: `${expenseBarPercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                {summary && summary.totalIncome > 0
                  ? `${expenseOfIncome.toFixed(0)}% das receitas`
                  : total > 0 ? "sem receitas no período" : "Nenhuma movimentação"}
              </p>
            </div>
          </div>

   
          <div className={`group relative rounded-2xl border p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden ${
            !summary || summary.balance >= 0
              ? "bg-gradient-to-br from-emerald-50 via-white to-white dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 border-emerald-200 dark:border-emerald-900/50"
              : "bg-gradient-to-br from-red-50 via-white to-white dark:from-red-950/30 dark:via-slate-900 dark:to-slate-900 border-red-200 dark:border-red-900/50"
          }`}>
            <div className={`absolute top-0 left-0 w-full h-0.5 rounded-t-2xl ${
              !summary || summary.balance >= 0
                ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
                : "bg-gradient-to-r from-red-400 to-red-600"
            }`} />
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Saldo</span>
              <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                !summary || summary.balance >= 0
                  ? "bg-emerald-100 dark:bg-emerald-900/40"
                  : "bg-red-100 dark:bg-red-900/40"
              }`}>
                <svg className={`w-4 h-4 ${!summary || summary.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${
              !summary || summary.balance >= 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              {summary ? formatCurrency(summary.balance) : "R$ 0,00"}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
              {!summary || summary.balance === 0
                ? "Nenhuma movimentação registrada"
                : summary.balance > 0
                  ? "Fluxo positivo neste periodo"
                  : "Fluxo negativo neste periodo"}
            </p>
          </div>
        </div>

   
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Histórico mensal</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Receitas e despesas — últimos 3 meses</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-emerald-500" />
                Receitas
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-red-500" />
                Despesas
              </div>
            </div>
          </div>

          {chartLoading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full"
                style={{ animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : chartData.every((m) => m.income === 0 && m.expense === 0) ? (
            <div className="h-40 flex items-center justify-center">
              <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma movimentação nos últimos 3 meses</p>
            </div>
          ) : (
            <svg
              viewBox="0 0 520 216"
              className="w-full select-none"
              onMouseLeave={() => setHoveredBar(null)}
            >
           
              {[1, 0.5, 0].map((ratio) => {
                const gy = C_PY1 - ratio * C_PH;
                return (
                  <g key={ratio}>
                    <line
                      x1={C_PX0} y1={gy}
                      x2={C_PX0 + C_PW + 16} y2={gy}
                      stroke={darkMode ? "#1e293b" : "#f1f5f9"}
                      strokeWidth={ratio === 0 ? 1.5 : 1}
                    />
                    <text
                      x={C_PX0 - 6} y={gy + 4}
                      textAnchor="end"
                      fontSize={9}
                      fill={darkMode ? "#475569" : "#94a3b8"}
                    >
                      {formatShort(chartMaxVal * ratio)}
                    </text>
                  </g>
                );
              })}

              {chartData.map((month, i) => {
                const gx = C_PX0 + i * C_GW;
                const ix = gx + C_IP;
                const ex = ix + C_BW + C_BG;
                const ih = chartBarH(month.income);
                const eh = chartBarH(month.expense);
                const dimIncome = hoveredBar !== null && !(hoveredBar.monthIdx === i && hoveredBar.type === "income");
                const dimExpense = hoveredBar !== null && !(hoveredBar.monthIdx === i && hoveredBar.type === "expense");
                return (
                  <g key={month.label}>
                    <rect
                      x={ix} y={chartBarY(month.income)}
                      width={C_BW} height={ih}
                      rx={4}
                      fill="#10b981"
                      fillOpacity={dimIncome ? 0.3 : 0.85}
                      style={{ cursor: "default", transition: "fill-opacity 0.15s" }}
                      onMouseEnter={() => setHoveredBar({ monthIdx: i, x: ix + C_BW / 2, y: chartBarY(month.income), value: month.income, type: "income" })}
                    />
                    <rect
                      x={ex} y={chartBarY(month.expense)}
                      width={C_BW} height={eh}
                      rx={4}
                      fill="#ef4444"
                      fillOpacity={dimExpense ? 0.3 : 0.85}
                      style={{ cursor: "default", transition: "fill-opacity 0.15s" }}
                      onMouseEnter={() => setHoveredBar({ monthIdx: i, x: ex + C_BW / 2, y: chartBarY(month.expense), value: month.expense, type: "expense" })}
                    />
                    <text
                      x={gx + C_GW / 2} y={C_PY1 + 18}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight="500"
                      fill={darkMode ? "#94a3b8" : "#64748b"}
                    >
                      {month.label}
                    </text>
                  </g>
                );
              })}

      
              {hoveredBar && (
                <g style={{ pointerEvents: "none" }}>
                  <rect
                    x={hoveredBar.x - 38} y={hoveredBar.y - 32}
                    width={76} height={22}
                    rx={5}
                    fill={darkMode ? "#f1f5f9" : "#1e293b"}
                    fillOpacity={0.95}
                  />
                  <text
                    x={hoveredBar.x} y={hoveredBar.y - 16}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight="600"
                    fill={darkMode ? "#1e293b" : "#f1f5f9"}
                  >
                    {formatShort(hoveredBar.value)}
                  </text>
                </g>
              )}
            </svg>
          )}
        </div>


        {summary && total > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
              Distribuicao do fluxo
            </p>
    
            <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 mb-5">
              <div
                className="bg-emerald-500 h-full transition-all duration-700"
                style={{ width: `${flowIncomePercent}%` }}
              />
              <div
                className="bg-red-500 h-full transition-all duration-700"
                style={{ width: `${flowExpensePercent}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Receitas</span>
                </div>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(summary.totalIncome)}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{flowIncomePercent.toFixed(0)}% do total</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Despesas</span>
                </div>
                <p className="text-sm font-bold text-red-500 dark:text-red-400 tabular-nums">
                  {formatCurrency(summary.totalExpense)}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{expenseOfIncome.toFixed(0)}% das receitas</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${summary.balance >= 0 ? "bg-emerald-600" : "bg-red-600"}`} />
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Saldo</span>
                </div>
                <p className={`text-sm font-bold tabular-nums ${summary.balance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(summary.balance)}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {summary.balance >= 0 ? "positivo" : "negativo"}
                </p>
              </div>
            </div>
          </div>
        )}


        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 gap-0">
          {(["transactions", "categories"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-5 py-3 text-sm font-semibold transition-colors ${
                tab === t
                  ? "text-orange-600 dark:text-orange-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {t === "transactions" ? "Movimentacoes" : "Categorias"}
              {tab === t && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-orange-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>


        {tab === "transactions" && (
          <div className="space-y-4">
   
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <select
                  value={filters.type || ""}
                  onChange={(e) =>
                    updateFilters({ ...filtersRef.current, type: (e.target.value as "income" | "expense") || undefined })
                  }
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 dark:focus:border-orange-500 transition shadow-sm"
                >
                  <option value="">Todos os tipos</option>
                  <option value="income">Receitas</option>
                  <option value="expense">Despesas</option>
                </select>

                <select
                  value={filters.categoryId || ""}
                  onChange={(e) =>
                    updateFilters({ ...filtersRef.current, categoryId: e.target.value || undefined })
                  }
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 dark:focus:border-orange-500 transition shadow-sm"
                >
                  <option value="">Todas as categorias</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                <input
                  type="date"
                  value={filters.startDate || ""}
                  onChange={(e) =>
                    updateFilters({ ...filtersRef.current, startDate: e.target.value || undefined })
                  }
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 dark:focus:border-orange-500 transition shadow-sm"
                />
                <input
                  type="date"
                  value={filters.endDate || ""}
                  onChange={(e) =>
                    updateFilters({ ...filtersRef.current, endDate: e.target.value || undefined })
                  }
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 dark:focus:border-orange-500 transition shadow-sm"
                />
              </div>

              <button
                onClick={() => { setEditingTx(null); setTxModal(true); }}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-orange-500/25"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nova movimentacao
              </button>
            </div>

      
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              {txLoading ? (
                <div className="py-20 text-center">
                  <div className="w-9 h-9 border-2 border-orange-400 border-t-transparent rounded-full mx-auto mb-3"
                    style={{ animation: "spin 0.8s linear infinite" }}
                  />
                  <p className="text-sm text-slate-400 dark:text-slate-500">Carregando movimentacoes...</p>
                </div>
              ) : !summary || summary.transactions.length === 0 ? (
                <div className="py-16 flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                    <svg className="w-7 h-7 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhuma movimentacao</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-5">
                    Registre sua primeira movimentacao financeira
                  </p>
                  <button
                    onClick={() => { setEditingTx(null); setTxModal(true); }}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Nova movimentacao
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          Descricao
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest hidden sm:table-cell">
                          Categoria
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest hidden md:table-cell">
                          Data
                        </th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest hidden sm:table-cell">
                          Tipo
                        </th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                          Valor
                        </th>
                        <th className="px-3 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {summary.transactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-1 h-9 rounded-full shrink-0 ${tx.type === "income" ? "bg-emerald-400" : "bg-red-400"}`} />
                              <div>
                                <p className="font-medium text-slate-800 dark:text-slate-200">{tx.description}</p>
                                {tx.notes && (
                                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[200px]">{tx.notes}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 hidden sm:table-cell">
                            {tx.category?.name ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700">
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
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-900/50">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Receita
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-semibold border border-red-200 dark:border-red-900/50">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                Despesa
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className={`text-sm font-bold tabular-nums ${tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                              {tx.type === "income" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                            </span>
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setEditingTx(tx); setTxModal(true); }}
                                className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
                </div>
              )}
            </div>
          </div>
        )}

   
        {tab === "categories" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => { setEditingCat(null); setCatModal(true); }}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-orange-500/25"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nova categoria
              </button>
            </div>

            {catLoading ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-20 text-center shadow-sm">
                <div className="w-9 h-9 border-2 border-orange-400 border-t-transparent rounded-full mx-auto mb-3"
                  style={{ animation: "spin 0.8s linear infinite" }}
                />
                <p className="text-sm text-slate-400 dark:text-slate-500">Carregando categorias...</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-16 flex flex-col items-center shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhuma categoria</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-5">
                  Crie categorias para organizar suas movimentacoes
                </p>
                <button
                  onClick={() => { setEditingCat(null); setCatModal(true); }}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Nova categoria
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {categories.map((cat) => {
                  const usedCount = summary?.transactions.filter((tx) => tx.category?.id === cat.id).length ?? 0;
                  const gradient = categoryGradient(cat.name);
                  return (
                    <div
                      key={cat.id}
                      className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 text-sm font-bold text-white shadow-sm`}>
                            {cat.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{cat.name}</p>
                            {cat.description && (
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{cat.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                          <button
                            onClick={() => { setEditingCat(cat); setCatModal(true); }}
                            className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Remover"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {usedCount} movimentacao{usedCount !== 1 ? "es" : ""} associada{usedCount !== 1 ? "s" : ""}
                        </span>
                        {usedCount > 0 && (
                          <span className="text-xs font-semibold text-orange-500 dark:text-orange-400">
                            {usedCount} tx
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      <TransactionModal
        open={txModal}
        onClose={() => setTxModal(false)}
        onSaved={() => fetchTransactions(filtersRef.current)}
        onSuccess={handleSuccess}
        categories={categories}
        editing={editingTx}
      />

      <CategoryModal
        open={catModal}
        onClose={() => setCatModal(false)}
        onSaved={fetchCategories}
        onSuccess={handleSuccess}
        editing={editingCat}
      />
    </div>
  );
}
