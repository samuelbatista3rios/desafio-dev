"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  Category,
  Goal,
  Transaction,
  TransactionFilters,
  TransactionSummary,
  categoriesApi,
  goalsApi,
  transactionsApi,
} from "@/lib/api";
import TransactionModal from "@/components/TransactionModal";
import CategoryModal from "@/components/CategoryModal";
import GoalModal from "@/components/GoalModal";
import GoalDepositModal from "@/components/GoalDepositModal";
import DonutChart from "@/components/DonutChart";
import TransactionCard from "@/components/TransactionCard";
import { useToast, ToastContainer } from "@/components/Toast";

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

type Tab = "transactions" | "categories" | "goals";

const TAB_LABELS: Record<Tab, string> = {
  transactions: "Movimentações",
  categories: "Categorias",
  goals: "Metas",
};

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function getDefaultMonthFilters(): TransactionFilters {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return {
    startDate: new Date(y, m, 1).toISOString().split("T")[0],
    endDate: new Date(y, m + 1, 0).toISOString().split("T")[0],
  };
}

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

const CHART_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#a855f7"];

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
  const [filters, setFilters] = useState<TransactionFilters>(getDefaultMonthFilters);
  const filtersRef = useRef<TransactionFilters>(getDefaultMonthFilters());
  const [txModal, setTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txLoading, setTxLoading] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catLoading, setCatLoading] = useState(true);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalModal, setGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [depositModal, setDepositModal] = useState(false);
  const [depositingGoal, setDepositingGoal] = useState<Goal | null>(null);
  const [goalLoading, setGoalLoading] = useState(true);
  const [pendingGoalIds, setPendingGoalIds] = useState<Set<string>>(new Set());

  const [chartData, setChartData] = useState<MonthlyData[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartView, setChartView] = useState<"bar" | "pie" | "line" | "annual">("bar");
  const [hoveredBar, setHoveredBar] = useState<{
    monthIdx: number;
    x: number;
    y: number;
    value: number;
    type: "income" | "expense";
  } | null>(null);

  // Feature 9: Annual data
  const [annualData, setAnnualData] = useState<MonthlyData[]>([]);
  const [annualLoading, setAnnualLoading] = useState(false);

  // Feature 4: Budget alert
  const [budgetAlertDismissed, setBudgetAlertDismissed] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"date" | "amount" | "description">("date");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // Undo delete
  const pendingDeletesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [pendingTxIds, setPendingTxIds] = useState<Set<string>>(new Set());
  const [pendingCatIds, setPendingCatIds] = useState<Set<string>>(new Set());

  const { toasts, removeToast, showSuccess, showError, showUndo } = useToast();

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
    fetchTransactions(filtersRef.current);
    fetchCategories();
    fetchChartData();
    fetchGoals();
    fetchAnnualData();
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

  async function fetchGoals() {
    setGoalLoading(true);
    try {
      const data = await goalsApi.list();
      setGoals(data);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
      }
    } finally {
      setGoalLoading(false);
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

  // Feature 9: fetchAnnualData
  async function fetchAnnualData() {
    setAnnualLoading(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const startDate = `${year}-01-01`;
      const data = await transactionsApi.list({ startDate });

      const months: MonthlyData[] = [];
      for (let m = 0; m < 12; m++) {
        const txs = data.transactions.filter((tx) => {
          const td = new Date(tx.date.split("T")[0] + "T12:00:00");
          return td.getFullYear() === year && td.getMonth() === m;
        });
        months.push({
          label: MONTHS_PT[m],
          income: txs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0),
          expense: txs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0),
        });
      }
      setAnnualData(months);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
      }
    } finally {
      setAnnualLoading(false);
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

  function handleDeleteTransaction(id: string) {
    if (pendingDeletesRef.current.has(id)) return;
    setPendingTxIds((prev) => new Set(prev).add(id));
    const timeoutId = setTimeout(async () => {
      pendingDeletesRef.current.delete(id);
      setPendingTxIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      try {
        await transactionsApi.remove(id);
        fetchTransactions(filtersRef.current);
      } catch {
        showError("Erro ao remover movimentação");
        setPendingTxIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      }
    }, 4000);
    pendingDeletesRef.current.set(id, timeoutId);
    showUndo("Movimentação removida", () => {
      clearTimeout(pendingDeletesRef.current.get(id));
      pendingDeletesRef.current.delete(id);
      setPendingTxIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    });
  }

  function handleDeleteCategory(id: string) {
    if (pendingDeletesRef.current.has(id)) return;
    setPendingCatIds((prev) => new Set(prev).add(id));
    const timeoutId = setTimeout(async () => {
      pendingDeletesRef.current.delete(id);
      setPendingCatIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      try {
        await categoriesApi.remove(id);
        fetchCategories();
      } catch {
        showError("Erro ao remover categoria");
        setPendingCatIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      }
    }, 4000);
    pendingDeletesRef.current.set(id, timeoutId);
    showUndo("Categoria removida", () => {
      clearTimeout(pendingDeletesRef.current.get(id));
      pendingDeletesRef.current.delete(id);
      setPendingCatIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    });
  }

  function handleDeleteGoal(id: string) {
    if (pendingDeletesRef.current.has(id)) return;
    setPendingGoalIds((prev) => new Set(prev).add(id));
    const timeoutId = setTimeout(async () => {
      pendingDeletesRef.current.delete(id);
      setPendingGoalIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      try {
        await goalsApi.remove(id);
        fetchGoals();
      } catch {
        showError("Erro ao remover meta");
        setPendingGoalIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      }
    }, 4000);
    pendingDeletesRef.current.set(id, timeoutId);
    showUndo("Meta removida", () => {
      clearTimeout(pendingDeletesRef.current.get(id));
      pendingDeletesRef.current.delete(id);
      setPendingGoalIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    });
  }

  // Feature 10: Export CSV
  function exportToCSV() {
    const txs = summary?.transactions ?? [];
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const filename = `movimentacoes_${y}-${m}.csv`;
    const header = "Descrição,Categoria,Data,Tipo,Valor";
    const rows = txs.map((tx) => {
      const desc = `"${tx.description.replace(/"/g, '""')}"`;
      const cat = `"${(tx.category?.name ?? "").replace(/"/g, '""')}"`;
      const date = formatDate(tx.date);
      const type = tx.type === "income" ? "Receita" : "Despesa";
      const amount = Number(tx.amount).toFixed(2).replace(".", ",");
      return [desc, cat, date, type, amount].join(",");
    });
    const csv = "\uFEFF" + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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

  // Feature 1: MoM comparison
  const prevMonthIncome = chartData[1]?.income ?? 0;
  const prevMonthExpense = chartData[1]?.expense ?? 0;
  const currMonthIncome = chartData[2]?.income ?? summary?.totalIncome ?? 0;
  const currMonthExpense = chartData[2]?.expense ?? summary?.totalExpense ?? 0;
  const incomeChangePct = prevMonthIncome > 0
    ? ((currMonthIncome - prevMonthIncome) / prevMonthIncome) * 100
    : null;
  const expenseChangePct = prevMonthExpense > 0
    ? ((currMonthExpense - prevMonthExpense) / prevMonthExpense) * 100
    : null;

  // Feature 2: Savings rate
  const totalIncome = summary?.totalIncome ?? 0;
  const totalExpense = summary?.totalExpense ?? 0;
  const savingsRate = totalIncome > 0
    ? ((totalIncome - totalExpense) / totalIncome) * 100
    : null;

  // Feature 3: Days remaining
  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = lastDayOfMonth - now.getDate();
  const balance = summary?.balance ?? 0;
  const dailyAvailable = daysRemaining > 0 ? balance / daysRemaining : balance;

  // Feature 4: Budget alert
  const budgetRatio = totalIncome > 0 ? totalExpense / totalIncome : 0;
  const showBudgetAlert = budgetRatio >= 0.8 && !budgetAlertDismissed && !!summary;

  // Feature 5: Active goals (not complete)
  const activeGoals = goals
    .filter((g) => {
      const pct = Math.min((Number(g.currentAmount) / Number(g.targetAmount)) * 100, 100);
      return pct < 100;
    })
    .slice(0, 3);

  // Feature 6: Top 3 expense categories
  const categoryExpenses: { name: string; value: number; color: string }[] = categories.map((cat, i) => ({
    name: cat.name,
    value: (summary?.transactions ?? [])
      .filter((tx) => tx.type === "expense" && tx.categoryId === cat.id)
      .reduce((s, tx) => s + Number(tx.amount), 0),
    color: CHART_COLORS[i % CHART_COLORS.length],
  })).filter((c) => c.value > 0).sort((a, b) => b.value - a.value).slice(0, 3);

  const maxCatExpense = categoryExpenses.length > 0 ? categoryExpenses[0].value : 1;

  // Feature 7: Last 5 transactions
  const last5Transactions = [...(summary?.transactions ?? [])]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

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

  // Annual chart dimensions
  const A_PX0 = 50, A_PY0 = 20, A_PW = 480, A_PH = 140;
  const A_PY1 = A_PY0 + A_PH;
  const A_GW = A_PW / 12;
  const A_BW = 10, A_BG = 3;
  const A_IP = (A_GW - A_BW * 2 - A_BG) / 2;
  const annualMaxVal = annualData.length > 0
    ? Math.max(...annualData.map((m) => Math.max(m.income, m.expense)), 1)
    : 1;
  const annualBarH = (v: number) => Math.max((v / annualMaxVal) * A_PH, v > 0 ? 2 : 0);
  const annualBarY = (v: number) => A_PY1 - annualBarH(v);

  // Feature 8: Daily balance line chart
  const currentMonthTxs = (summary?.transactions ?? []).filter((tx) => {
    const d = new Date(tx.date.split("T")[0] + "T12:00:00");
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const daysInMonth = lastDayOfMonth;
  const dailyBalances: number[] = [];
  let cumBalance = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dayTxs = currentMonthTxs.filter((tx) => {
      const d = new Date(tx.date.split("T")[0] + "T12:00:00");
      return d.getDate() === day;
    });
    cumBalance += dayTxs.reduce((s, tx) => s + (tx.type === "income" ? Number(tx.amount) : -Number(tx.amount)), 0);
    dailyBalances.push(cumBalance);
  }

  const L_PX0 = 60, L_PY0 = 20, L_PW = 460, L_PH = 140;
  const L_PY1 = L_PY0 + L_PH;
  const lineMinVal = Math.min(...dailyBalances, 0);
  const lineMaxVal = Math.max(...dailyBalances, 1);
  const lineRange = lineMaxVal - lineMinVal || 1;
  const lineX = (day: number) => L_PX0 + ((day - 1) / Math.max(daysInMonth - 1, 1)) * L_PW;
  const lineY = (val: number) => L_PY1 - ((val - lineMinVal) / lineRange) * L_PH;

  // Build SVG path for line chart
  const linePath = dailyBalances.map((v, i) => `${i === 0 ? "M" : "L"} ${lineX(i + 1).toFixed(1)} ${lineY(v).toFixed(1)}`).join(" ");
  const areaPath = dailyBalances.length > 0
    ? `${linePath} L ${lineX(daysInMonth).toFixed(1)} ${L_PY1} L ${lineX(1).toFixed(1)} ${L_PY1} Z`
    : "";

  // Dados para gráfico de pizza (despesas por categoria)
  const pieData = [
    ...categories.map((cat, i) => ({
      label: cat.name,
      value: (summary?.transactions ?? [])
        .filter((tx) => tx.type === "expense" && tx.categoryId === cat.id)
        .reduce((s, tx) => s + Number(tx.amount), 0),
      color: CHART_COLORS[i % CHART_COLORS.length],
    })).filter((d) => d.value > 0),
    ...((() => {
      const uncategorized = (summary?.transactions ?? [])
        .filter((tx) => tx.type === "expense" && !tx.categoryId)
        .reduce((s, tx) => s + Number(tx.amount), 0);
      return uncategorized > 0 ? [{ label: "Sem categoria", value: uncategorized, color: "#94a3b8" }] : [];
    })()),
  ];

  // Transações filtradas pela busca e ordenadas
  const displayedTransactions = (() => {
    const base = searchQuery.trim()
      ? (summary?.transactions ?? []).filter((tx) =>
          tx.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : (summary?.transactions ?? []);
    return [...base].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date.localeCompare(b.date);
      else if (sortField === "amount") cmp = Number(a.amount) - Number(b.amount);
      else if (sortField === "description") cmp = a.description.localeCompare(b.description);
      return sortDir === "asc" ? cmp : -cmp;
    });
  })();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0c0e14] transition-colors duration-300">

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

        {/* Feature 4: Budget Alert */}
        {showBudgetAlert && (
          <div className={`relative flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
            budgetRatio >= 1
              ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50"
              : "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/50"
          }`}>
            <span className="text-lg leading-none mt-0.5">⚠️</span>
            <p className={`text-sm font-medium flex-1 ${
              budgetRatio >= 1
                ? "text-red-700 dark:text-red-400"
                : "text-orange-700 dark:text-orange-400"
            }`}>
              Atenção: suas despesas estão em {(budgetRatio * 100).toFixed(0)}% da renda este mês
            </p>
            <button
              onClick={() => setBudgetAlertDismissed(true)}
              className={`shrink-0 p-1 rounded-lg transition-colors ${
                budgetRatio >= 1
                  ? "text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40"
                  : "text-orange-400 hover:text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/40"
              }`}
              title="Fechar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Cards de resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Receitas */}
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
            {/* Feature 1: MoM comparison */}
            {incomeChangePct !== null && (
              <div className={`flex items-center gap-1 mt-1.5 ${incomeChangePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                <span className="text-sm font-semibold">{incomeChangePct >= 0 ? "↑" : "↓"}</span>
                <span className="text-xs font-semibold">{Math.abs(incomeChangePct).toFixed(1)}% vs mês anterior</span>
              </div>
            )}
            <div className="mt-3">
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${incomeBarPercent}%` }} />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                {total > 0 ? "maior valor do período" : "Nenhuma movimentação"}
              </p>
            </div>
          </div>

          {/* Despesas */}
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
            {/* Feature 1: MoM comparison */}
            {expenseChangePct !== null && (
              <div className={`flex items-center gap-1 mt-1.5 ${expenseChangePct <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                <span className="text-sm font-semibold">{expenseChangePct >= 0 ? "↑" : "↓"}</span>
                <span className="text-xs font-semibold">{Math.abs(expenseChangePct).toFixed(1)}% vs mês anterior</span>
              </div>
            )}
            <div className="mt-3">
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full transition-all duration-700" style={{ width: `${expenseBarPercent}%` }} />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                {summary && summary.totalIncome > 0
                  ? `${expenseOfIncome.toFixed(0)}% das receitas`
                  : total > 0 ? "sem receitas no período" : "Nenhuma movimentação"}
              </p>
            </div>
          </div>

          {/* Saldo */}
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
                !summary || summary.balance >= 0 ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-red-100 dark:bg-red-900/40"
              }`}>
                <svg className={`w-4 h-4 ${!summary || summary.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${
              !summary || summary.balance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
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

        {/* Feature 2 & 3: Taxa de economia e Dias restantes */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Feature 2: Savings rate */}
            <div className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-0.5 rounded-t-2xl ${
                savingsRate !== null && savingsRate >= 0
                  ? "bg-gradient-to-r from-blue-400 to-blue-600"
                  : "bg-gradient-to-r from-amber-400 to-amber-600"
              }`} />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Taxa de economia</span>
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                  savingsRate !== null && savingsRate >= 0
                    ? "bg-blue-50 dark:bg-blue-900/30"
                    : "bg-amber-50 dark:bg-amber-900/30"
                }`}>
                  {/* Piggy bank icon */}
                  <svg className={`w-4 h-4 ${savingsRate !== null && savingsRate >= 0 ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              {savingsRate !== null ? (
                <>
                  <p className={`text-2xl font-bold tabular-nums ${savingsRate >= 0 ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {Math.abs(savingsRate).toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                    {savingsRate >= 0
                      ? `Você economizou ${savingsRate.toFixed(1)}% da renda este mês`
                      : `Déficit de ${Math.abs(savingsRate).toFixed(1)}% neste mês`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Sem receitas no período</p>
              )}
            </div>

            {/* Feature 3: Days remaining */}
            <div className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-violet-400 to-violet-600 rounded-t-2xl" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Dias restantes</span>
                <div className="w-9 h-9 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-400">
                {daysRemaining} dias
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                {daysRemaining > 0
                  ? `Faltam ${daysRemaining} dias • ${formatCurrency(dailyAvailable)}/dia disponível`
                  : `Último dia do mês • Saldo: ${formatCurrency(balance)}`}
              </p>
            </div>
          </div>
        )}

        {/* Gráfico com toggle */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {chartView === "bar" ? "Histórico mensal" : chartView === "pie" ? "Despesas por categoria" : chartView === "line" ? "Saldo diário" : "Resumo anual"}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {chartView === "bar" ? "Receitas e despesas — últimos 3 meses"
                  : chartView === "pie" ? "Distribuição das despesas por categoria"
                  : chartView === "line" ? `Evolução do saldo — ${MONTHS_FULL[now.getMonth()]} ${now.getFullYear()}`
                  : `Receitas e despesas — ${now.getFullYear()}`}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setChartView("bar")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  chartView === "bar"
                    ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                    : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setChartView("pie")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  chartView === "pie"
                    ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                    : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Por categoria
              </button>
              <button
                onClick={() => setChartView("line")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  chartView === "line"
                    ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                    : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Linha
              </button>
              <button
                onClick={() => setChartView("annual")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  chartView === "annual"
                    ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                    : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Anual
              </button>
              {(chartView === "bar" || chartView === "annual") && (
                <div className="flex items-center gap-3 ml-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-[3px] bg-emerald-500" />Receitas
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-[3px] bg-red-500" />Despesas
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bar chart */}
          {chartView === "bar" && (
            chartLoading ? (
              <div className="h-40 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full"
                  style={{ animation: "spin 0.8s linear infinite" }} />
              </div>
            ) : chartData.every((m) => m.income === 0 && m.expense === 0) ? (
              <div className="h-40 flex items-center justify-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma movimentação nos últimos 3 meses</p>
              </div>
            ) : (
              <svg viewBox="0 0 520 216" className="w-full select-none" onMouseLeave={() => setHoveredBar(null)}>
                {[1, 0.5, 0].map((ratio) => {
                  const gy = C_PY1 - ratio * C_PH;
                  return (
                    <g key={ratio}>
                      <line x1={C_PX0} y1={gy} x2={C_PX0 + C_PW + 16} y2={gy}
                        stroke={darkMode ? "#1e293b" : "#f1f5f9"}
                        strokeWidth={ratio === 0 ? 1.5 : 1}
                      />
                      <text x={C_PX0 - 6} y={gy + 4} textAnchor="end" fontSize={9} fill={darkMode ? "#475569" : "#94a3b8"}>
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
                      <rect x={ix} y={chartBarY(month.income)} width={C_BW} height={ih} rx={4}
                        fill="#10b981" fillOpacity={dimIncome ? 0.3 : 0.85}
                        style={{ cursor: "default", transition: "fill-opacity 0.15s" }}
                        onMouseEnter={() => setHoveredBar({ monthIdx: i, x: ix + C_BW / 2, y: chartBarY(month.income), value: month.income, type: "income" })}
                      />
                      <rect x={ex} y={chartBarY(month.expense)} width={C_BW} height={eh} rx={4}
                        fill="#ef4444" fillOpacity={dimExpense ? 0.3 : 0.85}
                        style={{ cursor: "default", transition: "fill-opacity 0.15s" }}
                        onMouseEnter={() => setHoveredBar({ monthIdx: i, x: ex + C_BW / 2, y: chartBarY(month.expense), value: month.expense, type: "expense" })}
                      />
                      <text x={gx + C_GW / 2} y={C_PY1 + 18} textAnchor="middle" fontSize={10} fontWeight="500" fill={darkMode ? "#94a3b8" : "#64748b"}>
                        {month.label}
                      </text>
                    </g>
                  );
                })}
                {hoveredBar && (
                  <g style={{ pointerEvents: "none" }}>
                    <rect x={hoveredBar.x - 38} y={hoveredBar.y - 32} width={76} height={22} rx={5}
                      fill={darkMode ? "#f1f5f9" : "#1e293b"} fillOpacity={0.95}
                    />
                    <text x={hoveredBar.x} y={hoveredBar.y - 16} textAnchor="middle" fontSize={10} fontWeight="600"
                      fill={darkMode ? "#1e293b" : "#f1f5f9"}
                    >
                      {formatShort(hoveredBar.value)}
                    </text>
                  </g>
                )}
              </svg>
            )
          )}

          {/* Pie chart */}
          {chartView === "pie" && (
            chartLoading ? (
              <div className="h-40 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full"
                  style={{ animation: "spin 0.8s linear infinite" }} />
              </div>
            ) : (
              <DonutChart data={pieData} darkMode={darkMode} />
            )
          )}

          {/* Feature 8: Line chart */}
          {chartView === "line" && (
            txLoading ? (
              <div className="h-40 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full"
                  style={{ animation: "spin 0.8s linear infinite" }} />
              </div>
            ) : dailyBalances.every((v) => v === 0) ? (
              <div className="h-40 flex items-center justify-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma movimentação neste mês</p>
              </div>
            ) : (
              <svg viewBox={`0 0 ${L_PX0 + L_PW + 20} ${L_PY0 + L_PH + 30}`} className="w-full select-none">
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const val = lineMinVal + ratio * lineRange;
                  const gy = lineY(val);
                  return (
                    <g key={ratio}>
                      <line x1={L_PX0} y1={gy} x2={L_PX0 + L_PW} y2={gy}
                        stroke={darkMode ? "#1e293b" : "#f1f5f9"} strokeWidth={1} strokeDasharray="4 2"
                      />
                      <text x={L_PX0 - 6} y={gy + 4} textAnchor="end" fontSize={9} fill={darkMode ? "#475569" : "#94a3b8"}>
                        {formatShort(val)}
                      </text>
                    </g>
                  );
                })}
                {/* Zero line */}
                {lineMinVal < 0 && lineMaxVal > 0 && (
                  <line x1={L_PX0} y1={lineY(0)} x2={L_PX0 + L_PW} y2={lineY(0)}
                    stroke={darkMode ? "#475569" : "#cbd5e1"} strokeWidth={1.5}
                  />
                )}
                {/* X axis labels */}
                {[1, Math.ceil(daysInMonth / 4), Math.ceil(daysInMonth / 2), Math.ceil(daysInMonth * 3 / 4), daysInMonth].map((day) => (
                  <text key={day} x={lineX(day)} y={L_PY1 + 18} textAnchor="middle" fontSize={9} fill={darkMode ? "#94a3b8" : "#64748b"}>
                    {day}
                  </text>
                ))}
                {/* Area fill */}
                {areaPath && (
                  <path d={areaPath} fill={balance >= 0 ? "#10b981" : "#ef4444"} fillOpacity={0.1} />
                )}
                {/* Line */}
                {linePath && (
                  <path d={linePath} fill="none" stroke={balance >= 0 ? "#10b981" : "#ef4444"} strokeWidth={2} strokeLinejoin="round" />
                )}
                {/* Points */}
                {dailyBalances.map((v, i) => (
                  <circle key={i} cx={lineX(i + 1)} cy={lineY(v)} r={2.5}
                    fill={v >= 0 ? "#10b981" : "#ef4444"} stroke={darkMode ? "#0f172a" : "#fff"} strokeWidth={1.5}
                  />
                ))}
              </svg>
            )
          )}

          {/* Feature 9: Annual chart */}
          {chartView === "annual" && (
            annualLoading ? (
              <div className="h-40 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full"
                  style={{ animation: "spin 0.8s linear infinite" }} />
              </div>
            ) : annualData.every((m) => m.income === 0 && m.expense === 0) ? (
              <div className="h-40 flex items-center justify-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">Nenhuma movimentação em {now.getFullYear()}</p>
              </div>
            ) : (
              <svg viewBox={`0 0 ${A_PX0 + A_PW + 20} ${A_PY0 + A_PH + 26}`} className="w-full select-none">
                {[1, 0.5, 0].map((ratio) => {
                  const gy = A_PY1 - ratio * A_PH;
                  return (
                    <g key={ratio}>
                      <line x1={A_PX0} y1={gy} x2={A_PX0 + A_PW + 10} y2={gy}
                        stroke={darkMode ? "#1e293b" : "#f1f5f9"}
                        strokeWidth={ratio === 0 ? 1.5 : 1}
                      />
                      <text x={A_PX0 - 6} y={gy + 4} textAnchor="end" fontSize={8} fill={darkMode ? "#475569" : "#94a3b8"}>
                        {formatShort(annualMaxVal * ratio)}
                      </text>
                    </g>
                  );
                })}
                {annualData.map((month, i) => {
                  const gx = A_PX0 + i * A_GW;
                  const ix = gx + A_IP;
                  const ex = ix + A_BW + A_BG;
                  const ih = annualBarH(month.income);
                  const eh = annualBarH(month.expense);
                  return (
                    <g key={month.label}>
                      <rect x={ix} y={annualBarY(month.income)} width={A_BW} height={ih} rx={3}
                        fill="#10b981" fillOpacity={0.85}
                      />
                      <rect x={ex} y={annualBarY(month.expense)} width={A_BW} height={eh} rx={3}
                        fill="#ef4444" fillOpacity={0.85}
                      />
                      <text x={gx + A_GW / 2} y={A_PY1 + 14} textAnchor="middle" fontSize={8} fontWeight="500" fill={darkMode ? "#94a3b8" : "#64748b"}>
                        {month.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )
          )}
        </div>

        {/* Distribuição do fluxo */}
        {summary && total > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
              Distribuição do fluxo
            </p>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 mb-5">
              <div className="bg-emerald-500 h-full transition-all duration-700" style={{ width: `${flowIncomePercent}%` }} />
              <div className="bg-red-500 h-full transition-all duration-700" style={{ width: `${flowExpensePercent}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Receitas</span>
                </div>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(summary.totalIncome)}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{flowIncomePercent.toFixed(0)}% do total</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Despesas</span>
                </div>
                <p className="text-sm font-bold text-red-500 dark:text-red-400 tabular-nums">{formatCurrency(summary.totalExpense)}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{flowExpensePercent.toFixed(0)}% do total</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${summary.balance >= 0 ? "bg-emerald-600" : "bg-red-600"}`} />
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Saldo</span>
                </div>
                <p className={`text-sm font-bold tabular-nums ${summary.balance >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(summary.balance)}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{summary.balance >= 0 ? "positivo" : "negativo"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Feature 5: Widget de Metas no overview */}
        {activeGoals.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Metas em andamento
              </p>
              <button
                onClick={() => setTab("goals")}
                className="text-xs font-semibold text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 transition-colors"
              >
                Ver todas →
              </button>
            </div>
            <div className="space-y-3">
              {activeGoals.map((goal) => {
                const current = Number(goal.currentAmount);
                const target = Number(goal.targetAmount);
                const pct = Math.min((current / target) * 100, 100);
                const barColor = pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
                return (
                  <div key={goal.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{goal.name}</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-2 shrink-0">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Feature 6 & 7: Top 3 gastos e Últimas 5 movimentações */}
        {(categoryExpenses.length > 0 || last5Transactions.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Feature 6: Top 3 expense categories */}
            {categoryExpenses.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
                  Maiores gastos
                </p>
                <div className="space-y-3">
                  {categoryExpenses.map((cat, idx) => (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-4">#{idx + 1}</span>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{cat.name}</span>
                        </div>
                        <span className="text-sm font-bold text-red-500 dark:text-red-400 tabular-nums">
                          {formatCurrency(cat.value)}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(cat.value / maxCatExpense) * 100}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feature 7: Last 5 transactions */}
            {last5Transactions.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Últimas movimentações
                  </p>
                  <button
                    onClick={() => setTab("transactions")}
                    className="text-xs font-semibold text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 transition-colors"
                  >
                    Ver todas →
                  </button>
                </div>
                <div className="space-y-2.5">
                  {last5Transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.type === "income"
                          ? "bg-emerald-50 dark:bg-emerald-900/20"
                          : "bg-red-50 dark:bg-red-900/20"
                      }`}>
                        <svg className={`w-4 h-4 ${tx.type === "income" ? "text-emerald-500" : "text-red-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          {tx.type === "income"
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />}
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{tx.description}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{formatDate(tx.date)}</p>
                      </div>
                      <span className={`text-sm font-bold tabular-nums shrink-0 ${tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                        {tx.type === "income" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 gap-0">
          {(["transactions", "categories", "goals"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-5 py-3 text-sm font-semibold transition-colors ${
                tab === t
                  ? "text-orange-600 dark:text-orange-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {TAB_LABELS[t]}
              {tab === t && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-orange-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* Tab: Movimentações */}
        {tab === "transactions" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <select
                  value={filters.type || ""}
                  onChange={(e) => updateFilters({ ...filtersRef.current, type: (e.target.value as "income" | "expense") || undefined })}
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 dark:focus:border-orange-500 transition shadow-sm"
                >
                  <option value="">Todos os tipos</option>
                  <option value="income">Receitas</option>
                  <option value="expense">Despesas</option>
                </select>

                <select
                  value={filters.categoryId || ""}
                  onChange={(e) => updateFilters({ ...filtersRef.current, categoryId: e.target.value || undefined })}
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 dark:focus:border-orange-500 transition shadow-sm"
                >
                  <option value="">Todas as categorias</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const cur = filters.startDate ? new Date(filters.startDate + "T12:00:00") : new Date();
                      const y = cur.getFullYear();
                      const m = cur.getMonth(); // vai para mês anterior
                      updateFilters({
                        ...filtersRef.current,
                        startDate: new Date(y, m - 1, 1).toISOString().split("T")[0],
                        endDate: new Date(y, m, 0).toISOString().split("T")[0],
                      });
                    }}
                    className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-orange-400 dark:hover:border-orange-500 text-slate-500 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 rounded-xl transition shadow-sm"
                    title="Mês anterior"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <input
                    type="month"
                    value={filters.startDate ? filters.startDate.slice(0, 7) : ""}
                    onChange={(e) => {
                      const [y, m] = e.target.value.split("-").map(Number);
                      if (!y || !m) return;
                      updateFilters({
                        ...filtersRef.current,
                        startDate: new Date(y, m - 1, 1).toISOString().split("T")[0],
                        endDate: new Date(y, m, 0).toISOString().split("T")[0],
                      });
                    }}
                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 dark:focus:border-orange-500 transition shadow-sm"
                  />

                  <button
                    onClick={() => {
                      const cur = filters.startDate ? new Date(filters.startDate + "T12:00:00") : new Date();
                      const y = cur.getFullYear();
                      const m = cur.getMonth() + 2; // vai para próximo mês
                      updateFilters({
                        ...filtersRef.current,
                        startDate: new Date(y, m - 1, 1).toISOString().split("T")[0],
                        endDate: new Date(y, m, 0).toISOString().split("T")[0],
                      });
                    }}
                    className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-orange-400 dark:hover:border-orange-500 text-slate-500 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 rounded-xl transition shadow-sm"
                    title="Próximo mês"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {(() => {
                    const def = getDefaultMonthFilters();
                    const isCurrentMonth = filters.startDate === def.startDate && filters.endDate === def.endDate;
                    return !isCurrentMonth ? (
                      <button
                        onClick={() => updateFilters({ ...filtersRef.current, ...getDefaultMonthFilters() })}
                        className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-orange-400 dark:hover:border-orange-500 text-slate-500 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 rounded-xl text-xs font-medium transition shadow-sm whitespace-nowrap"
                        title="Voltar ao mês atual"
                      >
                        Mês atual
                      </button>
                    ) : null;
                  })()}
                </div>

                {/* Busca por descrição */}
                <input
                  type="search"
                  placeholder="Buscar descrição..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 dark:focus:border-orange-500 transition shadow-sm w-full sm:w-44"
                />
              </div>

              <div className="flex items-center gap-2">
                {/* Feature 10: Export CSV */}
                {summary && summary.transactions.length > 0 && (
                  <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-orange-400 dark:hover:border-orange-500 hover:text-orange-600 dark:hover:text-orange-400 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Exportar CSV
                  </button>
                )}

                <button
                  onClick={() => { setEditingTx(null); setTxModal(true); }}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-orange-500/25"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Nova movimentação
                </button>
              </div>
            </div>

            {!txLoading && displayedTransactions.length > 0 && (() => {
              const totalIncome = displayedTransactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
              const totalExpense = displayedTransactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
              const balance = totalIncome - totalExpense;
              return (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/40">
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Receitas</span>
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">+{formatCurrency(totalIncome)}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40">
                      <span className="text-xs text-red-500 dark:text-red-400 font-medium">Despesas</span>
                      <span className="text-xs font-bold text-red-600 dark:text-red-300 tabular-nums">-{formatCurrency(totalExpense)}</span>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${balance >= 0 ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/40" : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900/40"}`}>
                      <span className={`text-xs font-medium ${balance >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`}>Saldo</span>
                      <span className={`text-xs font-bold tabular-nums ${balance >= 0 ? "text-blue-700 dark:text-blue-300" : "text-orange-700 dark:text-orange-300"}`}>{balance >= 0 ? "+" : ""}{formatCurrency(balance)}</span>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 self-center">{displayedTransactions.length} movimentação{displayedTransactions.length !== 1 ? "ões" : ""}</span>
                  </div>
                  {(filters.type || filters.categoryId || searchQuery.trim()) && (
                    <button
                      onClick={() => { setSearchQuery(""); updateFilters({ startDate: filtersRef.current.startDate, endDate: filtersRef.current.endDate }); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-orange-400 hover:text-orange-500 dark:hover:text-orange-400 transition shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Limpar filtros
                    </button>
                  )}
                </div>
              );
            })()}
            {!txLoading && displayedTransactions.length === 0 && (filters.type || filters.categoryId || searchQuery.trim()) && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400 dark:text-slate-500">Nenhuma movimentação encontrada</p>
                <button
                  onClick={() => { setSearchQuery(""); updateFilters({ startDate: filtersRef.current.startDate, endDate: filtersRef.current.endDate }); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-orange-400 hover:text-orange-500 transition shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Limpar filtros
                </button>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              {txLoading ? (
                <div className="py-20 text-center">
                  <div className="w-9 h-9 border-2 border-orange-400 border-t-transparent rounded-full mx-auto mb-3"
                    style={{ animation: "spin 0.8s linear infinite" }}
                  />
                  <p className="text-sm text-slate-400 dark:text-slate-500">Carregando movimentações...</p>
                </div>
              ) : !summary || summary.transactions.length === 0 ? (
                <div className="py-16 flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                    <svg className="w-7 h-7 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhuma movimentação</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-5">Registre sua primeira movimentação financeira</p>
                  <button
                    onClick={() => { setEditingTx(null); setTxModal(true); }}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Nova movimentação
                  </button>
                </div>
              ) : displayedTransactions.length === 0 ? (
                <div className="py-12 flex flex-col items-center">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhum resultado</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Nenhuma movimentação encontrada para &ldquo;{searchQuery}&rdquo;</p>
                </div>
              ) : (
                <>
                  {/* Mobile: cards com swipe */}
                  <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {displayedTransactions.map((tx) => (
                      <TransactionCard
                        key={tx.id}
                        transaction={tx}
                        onEdit={() => { setEditingTx(tx); setTxModal(true); }}
                        onDelete={() => handleDeleteTransaction(tx.id)}
                        pending={pendingTxIds.has(tx.id)}
                      />
                    ))}
                  </div>

                  {/* Desktop: tabela */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                          {([
                            { key: "description", label: "Descrição", align: "left", cls: "" },
                            { key: null, label: "Categoria", align: "left", cls: "hidden sm:table-cell" },
                            { key: "date", label: "Data", align: "left", cls: "hidden md:table-cell" },
                            { key: null, label: "Tipo", align: "left", cls: "hidden sm:table-cell" },
                            { key: "amount", label: "Valor", align: "right", cls: "" },
                          ] as { key: "date" | "amount" | "description" | null; label: string; align: string; cls: string }[]).map(({ key, label, align, cls }) => (
                            <th
                              key={label}
                              onClick={key ? () => { if (sortField === key) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortField(key); setSortDir("desc"); } } : undefined}
                              className={`px-5 py-3 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest ${align === "right" ? "text-right" : "text-left"} ${cls} ${key ? "cursor-pointer hover:text-orange-500 dark:hover:text-orange-400 select-none transition-colors" : ""}`}
                            >
                              <span className="inline-flex items-center gap-1">
                                {label}
                                {key && sortField === key && (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d={sortDir === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                                  </svg>
                                )}
                              </span>
                            </th>
                          ))}
                          <th className="px-3 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {displayedTransactions.reduce<React.ReactNode[]>((rows, tx, i) => {
                          const prev = displayedTransactions[i - 1];
                          if (sortField === "date" && (!prev || prev.date !== tx.date)) {
                            rows.push(
                              <tr key={`day-${tx.date}`} className="bg-slate-50/80 dark:bg-slate-800/60">
                                <td colSpan={6} className="px-5 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                  {formatDate(tx.date)}
                                </td>
                              </tr>
                            );
                          }
                          rows.push(
                          <tr
                            key={tx.id}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${pendingTxIds.has(tx.id) ? "opacity-40 pointer-events-none" : ""}`}
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-1 h-9 rounded-full shrink-0 ${tx.type === "income" ? "bg-emerald-400" : "bg-red-400"}`} />
                                <div>
                                  <p className="font-medium text-slate-800 dark:text-slate-200">{tx.description}</p>
                                  {tx.notes && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[200px]">{tx.notes}</p>
                                  )}
                                  {pendingTxIds.has(tx.id) && (
                                    <p className="text-xs text-amber-500 mt-0.5">A ser removido...</p>
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
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Receita
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-semibold border border-red-200 dark:border-red-900/50">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />Despesa
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <span className={`text-sm font-bold tabular-nums ${tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                                {tx.type === "income" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                              </span>
                            </td>
                            <td className="px-3 py-4">
                              <div className="flex gap-1 justify-end opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
                          );
                          return rows;
                        }, [])}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab: Categorias */}
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
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-5">Crie categorias para organizar suas movimentações</p>
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
                  const isPending = pendingCatIds.has(cat.id);
                  return (
                    <div
                      key={cat.id}
                      className={`group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${isPending ? "opacity-40 pointer-events-none" : ""}`}
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
                            {isPending && <p className="text-xs text-amber-500 mt-0.5">A ser removida...</p>}
                          </div>
                        </div>
                        <div className="flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 ml-2">
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
                          {usedCount} movimentação{usedCount !== 1 ? "ões" : ""} associada{usedCount !== 1 ? "s" : ""}
                        </span>
                        {usedCount > 0 && (
                          <span className="text-xs font-semibold text-orange-500 dark:text-orange-400">{usedCount} tx</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Metas */}
        {tab === "goals" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => { setEditingGoal(null); setGoalModal(true); }}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm shadow-orange-500/25"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nova meta
              </button>
            </div>

            {goalLoading ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-20 text-center shadow-sm">
                <div className="w-9 h-9 border-2 border-orange-400 border-t-transparent rounded-full mx-auto mb-3"
                  style={{ animation: "spin 0.8s linear infinite" }}
                />
                <p className="text-sm text-slate-400 dark:text-slate-500">Carregando metas...</p>
              </div>
            ) : goals.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 py-16 flex flex-col items-center shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhuma meta criada</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-5">Defina metas financeiras e acompanhe seu progresso</p>
                <button
                  onClick={() => { setEditingGoal(null); setGoalModal(true); }}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Nova meta
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {goals.map((goal) => {
                  const current = Number(goal.currentAmount);
                  const target = Number(goal.targetAmount);
                  const pct = Math.min((current / target) * 100, 100);
                  const isComplete = pct >= 100;
                  const isExpired = goal.deadline && new Date(goal.deadline) < new Date();
                  const isPending = pendingGoalIds.has(goal.id);
                  const barColor = isComplete ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
                  const remaining = Math.max(0, target - current);
                  const monthsLeft = goal.deadline
                    ? (new Date(goal.deadline + "T12:00:00").getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30.4375)
                    : null;
                  const monthlyNeeded = !isComplete && monthsLeft !== null && monthsLeft > 0 ? remaining / monthsLeft : null;

                  return (
                    <div
                      key={goal.id}
                      className={`group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all duration-200 ${isPending ? "opacity-40 pointer-events-none" : ""}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{goal.name}</p>
                            {goal.deadline && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className={`text-xs ${isExpired && !isComplete ? "text-red-500" : "text-slate-400 dark:text-slate-500"}`}>
                                  {isExpired && !isComplete ? "Prazo expirado · " : "Prazo: "}
                                  {new Date(goal.deadline + "T12:00:00").toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                          <button
                            onClick={() => { setEditingGoal(goal); setGoalModal(true); }}
                            className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteGoal(goal.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Remover"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Barra de progresso */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-slate-400 dark:text-slate-500">Progresso</span>
                          <span className={`text-xs font-bold ${isComplete ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300"}`}>
                            {pct.toFixed(0)}%{isComplete && " ✓"}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {monthlyNeeded !== null && (
                        <div className="mb-3 flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 rounded-xl px-3 py-2">
                          <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            Deposite <span className="font-bold">{formatCurrency(monthlyNeeded)}/mês</span> para alcançar no prazo
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                            {formatCurrency(current)}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">de {formatCurrency(target)}</p>
                        </div>
                        {!isComplete && (
                          <button
                            onClick={() => { setDepositingGoal(goal); setDepositModal(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded-xl text-xs font-semibold transition-colors border border-orange-200 dark:border-orange-900/50"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Depositar
                          </button>
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
        onSuccess={showSuccess}
        categories={categories}
        editing={editingTx}
      />

      <CategoryModal
        open={catModal}
        onClose={() => setCatModal(false)}
        onSaved={fetchCategories}
        onSuccess={showSuccess}
        editing={editingCat}
      />

      <GoalModal
        open={goalModal}
        onClose={() => setGoalModal(false)}
        onSaved={fetchGoals}
        onSuccess={showSuccess}
        editing={editingGoal}
      />

      <GoalDepositModal
        open={depositModal}
        onClose={() => setDepositModal(false)}
        onDeposited={fetchGoals}
        onSuccess={showSuccess}
        goal={depositingGoal}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
