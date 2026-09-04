export interface DashboardMetrics {
  customers: number; leads: number; activeCustomers: number; overdueFollowUps: number;
  openDeals: number; pipelineValue: number; weightedForecast: number; wonRevenue: number;
  activeProjects: number; pendingTasks: number; overdueTasks: number; activeEmployees: number; openInquiries: number;
  invoiced: number; received: number; outstanding: number; expenses: number; netCash: number; currentMonthRevenue: number; currentMonthExpenses: number; currentMonthProfit: number;
  orders: number; activeOrders: number; orderValue: number; stockOnHand: number; stockReserved: number; lowStock: number;
  activeCampaigns: number; marketingSpend: number; marketingLeads: number; conversions: number; attributedRevenue: number; returnOnSpend: number; openTickets: number; overdueTickets: number;
}
export interface DashboardAlert { type: string; count: number; label: string; view: string }
export interface DashboardRecent { customers: { id: string; displayName: string; status: string; createdAt: string }[]; projects: { id: string; name: string; code: string; status: string; updatedAt: string }[]; activities: { id: string; type: string; summary: string; occurredAt: string; customer: { displayName: string } }[] }
export interface DashboardData { periodDays: number | null; enabledServices: string[]; currency: string; timezone: string; metrics: DashboardMetrics; alerts: DashboardAlert[]; monthlyCash: { month: string; revenue: number; expenses: number; profit: number }[]; recent: DashboardRecent }
export interface DashboardPayload { success: true; data: DashboardData }
