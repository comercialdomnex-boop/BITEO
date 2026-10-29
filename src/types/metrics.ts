export interface OrdersDashboardMetrics {
  totalToday: number;
  grossSalesToday: number;
  newOrdersCount: number;
  inPrepCount: number;
  inDeliveryCount: number;
  completedCount: number;
  cancelledCount: number;
  averageTicket: number;
}

export interface SalesReportSummary {
  period: string;
  totalSales: number;
  ordersCount: number;
  averageTicket: number;
  deliverySharePercentage: number;
  takeawaySharePercentage: number;
  topSellingItems: {
    name: string;
    quantity: number;
    totalAmount: number;
  }[];
}
