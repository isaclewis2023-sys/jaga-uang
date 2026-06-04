export type AccountType = 'bank' | 'cash' | 'savings' | 'investment' | 'credit'
export type TransactionType = 'income' | 'expense'
export type CategoryType = 'income' | 'expense'
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type HealthLabel = 'CRITICAL' | 'WARNING' | 'GOOD' | 'EXCELLENT'
export type GoalStatus = 'in_progress' | 'achieved' | 'overdue'

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: number
  color: string
  icon: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  type: CategoryType
  color: string
  icon: string
  isDefault: boolean
  createdAt: string
}

export interface Transaction {
  id: string
  accountId: string
  categoryId: string
  type: TransactionType
  amount: number
  description: string
  date: string
  notes: string | null
  isRecurring: boolean
  recurringId: string | null
  createdAt: string
  updatedAt: string
  account?: Account
  category?: Category
}

export interface Transfer {
  id: string
  fromAccountId: string
  toAccountId: string
  amount: number
  description: string
  date: string
  createdAt: string
  fromAccount?: Account
  toAccount?: Account
}

export interface RecurringRule {
  id: string
  accountId: string
  categoryId: string
  type: TransactionType
  amount: number
  description: string
  frequency: RecurringFrequency
  startDate: string
  endDate: string | null
  nextDue: string
  isActive: boolean
  createdAt: string
  account?: Account
  category?: Category
}

export interface Budget {
  id: string
  categoryId: string
  amount: number
  month: number
  year: number
  createdAt: string
  updatedAt: string
  category?: Category
  spent?: number
}

export interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline: string | null
  color: string
  icon: string
  description: string | null
  isCompleted: boolean
  createdAt: string
  updatedAt: string
}

export interface FinancialHealthScore {
  total: number
  label: HealthLabel
  savingsRate: number
  savingsScore: number
  budgetScore: number
  emergencyScore: number
  goalScore: number
}

export interface DashboardStats {
  totalIncome: number
  totalExpense: number
  netBalance: number
  savingsRate: number
  netWorth: number
  accounts: Account[]
  recentTransactions: Transaction[]
  healthScore: FinancialHealthScore
}

export interface ReportPeriod {
  label: string
  startDate: string
  endDate: string
}

export interface MonthlyData {
  month: string
  income: number
  expense: number
  net: number
}

export interface CategoryBreakdown {
  categoryId: string
  categoryName: string
  color: string
  amount: number
  percentage: number
  count: number
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}
