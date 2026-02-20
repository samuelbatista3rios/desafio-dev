const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type");
  const data =
    response.status !== 204 && contentType?.includes("application/json")
      ? await response.json()
      : null;

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
      throw new Error("Unauthorized");
    }
    throw new Error(
      Array.isArray(data?.message)
        ? data.message.join(", ")
        : data?.message || "Erro na requisição"
    );
  }

  return data as T;
}

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
};

// Users
export const usersApi = {
  register: (name: string, email: string, password: string) =>
    request<User>("/users/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  me: () => request<User>("/users/me"),
};

// Categories
export const categoriesApi = {
  list: () => request<Category[]>("/categories"),
  create: (data: { name: string; description?: string }) =>
    request<Category>("/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name?: string; description?: string }) =>
    request<Category>(`/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request<void>(`/categories/${id}`, { method: "DELETE" }),
};

// Transactions
export const transactionsApi = {
  list: (filters?: TransactionFilters) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set("type", filters.type);
    if (filters?.categoryId) params.set("categoryId", filters.categoryId);
    if (filters?.startDate) params.set("startDate", filters.startDate);
    if (filters?.endDate) params.set("endDate", filters.endDate);
    const qs = params.toString();
    return request<TransactionSummary>(`/transactions${qs ? `?${qs}` : ""}`);
  },
  create: (data: CreateTransactionPayload) =>
    request<Transaction>("/transactions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<CreateTransactionPayload>) =>
    request<Transaction>(`/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request<void>(`/transactions/${id}`, { method: "DELETE" }),
};

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  userId: string;
}

export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  date: string;
  notes?: string;
  categoryId?: string;
  category?: Category;
  userId: string;
  createdAt: string;
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactions: Transaction[];
}

export interface TransactionFilters {
  type?: TransactionType;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}

export interface CreateTransactionPayload {
  description: string;
  amount: number;
  type: TransactionType;
  date: string;
  notes?: string;
  categoryId?: string;
}
