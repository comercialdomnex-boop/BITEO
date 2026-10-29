import React, { useState, useMemo } from 'react';
import { Order, PaymentMethod } from '../../types';
import { formatCurrency } from '../../components/shared';
import { phoneIdentity } from '../../utils/phone';
import { fromCents, sumCents, toCents } from '../../utils/money';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Bike,
  Store,
  PieChart,
  Award,
  Calendar,
  AlertTriangle,
  CreditCard,
  QrCode,
  Banknote,
  Clock,
  CalendarDays,
  Percent,
  Receipt,
  Users,
} from 'lucide-react';

interface ReportsViewProps {
  orders: Order[];
}

type PeriodFilter = 'hoje' | '7dias' | '30dias' | 'mes' | 'personalizado';

export const ReportsView: React.FC<ReportsViewProps> = ({ orders }) => {
  const [period, setPeriod] = useState<PeriodFilter>('hoje');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Filter orders by period
  const filteredOrders = useMemo(() => {
    const now = new Date();

    return orders.filter(order => {
      const orderDate = new Date(order.createdAt);

      if (period === 'hoje') {
        return (
          orderDate.getFullYear() === now.getFullYear() &&
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getDate() === now.getDate()
        );
      }

      if (period === '7dias') {
        const diffMs = now.getTime() - orderDate.getTime();
        return diffMs <= 7 * 24 * 60 * 60 * 1000;
      }

      if (period === '30dias') {
        const diffMs = now.getTime() - orderDate.getTime();
        return diffMs <= 30 * 24 * 60 * 60 * 1000;
      }

      if (period === 'mes') {
        return (
          orderDate.getFullYear() === now.getFullYear() &&
          orderDate.getMonth() === now.getMonth()
        );
      }

      if (period === 'personalizado') {
        const start = new Date(`${customStartDate}T00:00:00`);
        const end = new Date(`${customEndDate}T23:59:59`);
        return orderDate >= start && orderDate <= end;
      }

      return true;
    });
  }, [orders, period, customStartDate, customEndDate]);

  // Derived financial & operation metrics (100% strictly computed from orders)
  const stats = useMemo(() => {
    const validOrders = filteredOrders.filter(o => o.status !== 'cancelado');
    const cancelledOrders = filteredOrders.filter(o => o.status === 'cancelado');

    const grossSalesCents = sumCents(validOrders.map(o => o.total));
    const grossSales = fromCents(grossSalesCents);
    const validCount = validOrders.length;
    const totalCount = filteredOrders.length;
    const avgTicket = validCount > 0 ? fromCents(Math.round(grossSalesCents / validCount)) : 0;

    // Delivery fees earned
    const deliveryFees = fromCents(sumCents(validOrders.map(o => o.deliveryFee)));

    // Cancelled metrics
    const cancelledCount = cancelledOrders.length;
    const cancellationRate = totalCount > 0 ? (cancelledCount / totalCount) * 100 : 0;
    const lostRevenue = fromCents(sumCents(cancelledOrders.map(o => o.total)));

    // Group cancellation by reasons (accumulated in cents)
    const cancellationReasonsMap = new Map<string, { count: number; totalCents: number }>();
    cancelledOrders.forEach(o => {
      const reason = o.cancellationReason || 'Não informado';
      const existing = cancellationReasonsMap.get(reason) || { count: 0, totalCents: 0 };
      cancellationReasonsMap.set(reason, {
        count: existing.count + 1,
        totalCents: existing.totalCents + toCents(o.total),
      });
    });
    const cancellationReasons = Array.from(cancellationReasonsMap.entries()).map(
      ([reason, data]) => ({
        reason,
        count: data.count,
        total: fromCents(data.totalCents),
      })
    );

    // Unique customers in period
    const customerMap = new Map<string, number>();
    validOrders.forEach(o => {
      const key = phoneIdentity(o.customer.phone) || o.customer.id;
      customerMap.set(key, (customerMap.get(key) || 0) + 1);
    });

    let newCustCount = 0;
    let returningCustCount = 0;
    customerMap.forEach(orderCount => {
      if (orderCount === 1) newCustCount += 1;
      else returningCustCount += 1;
    });

    // Modality breakdown
    const deliveryOrders = validOrders.filter(o => o.type === 'delivery');
    const pickupOrders = validOrders.filter(o => o.type === 'retirada');
    const deliveryTotal = fromCents(sumCents(deliveryOrders.map(o => o.total)));
    const pickupTotal = fromCents(sumCents(pickupOrders.map(o => o.total)));
    const deliveryPct = validCount > 0 ? Math.round((deliveryOrders.length / validCount) * 100) : 0;
    const pickupPct = validCount > 0 ? 100 - deliveryPct : 0;

    // Payment methods breakdown
    const paymentMap: Record<PaymentMethod, { count: number; total: number }> = {
      pix: { count: 0, total: 0 },
      cartao_credito: { count: 0, total: 0 },
      cartao_debito: { count: 0, total: 0 },
      dinheiro: { count: 0, total: 0 },
    };

    validOrders.forEach(o => {
      if (paymentMap[o.paymentMethod]) {
        paymentMap[o.paymentMethod].count += 1;
        paymentMap[o.paymentMethod].total += o.total;
      }
    });

    // Top selling products
    const itemMap = new Map<string, { quantity: number; total: number }>();
    validOrders.forEach(o => {
      o.items.forEach(i => {
        const cur = itemMap.get(i.name) || { quantity: 0, total: 0 };
        itemMap.set(i.name, {
          quantity: cur.quantity + i.quantity,
          total: cur.total + i.totalPrice,
        });
      });
    });

    const topItems = Array.from(itemMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Distribution by time of day
    const timeSlots = {
      almoco: 0, // 11h - 14h
      tarde: 0, // 14h - 18h
      noite: 0, // 18h - 23h
      outros: 0, // madrugada/manhã
    };

    validOrders.forEach(o => {
      const hour = new Date(o.createdAt).getHours();
      if (hour >= 11 && hour < 14) timeSlots.almoco += 1;
      else if (hour >= 14 && hour < 18) timeSlots.tarde += 1;
      else if (hour >= 18 && hour < 23) timeSlots.noite += 1;
      else timeSlots.outros += 1;
    });

    // Distribution by day of week (0 = Sun, 1 = Mon ... 6 = Sat)
    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Dom, Seg, Ter, Qua, Qui, Sex, Sáb
    validOrders.forEach(o => {
      const d = new Date(o.createdAt).getDay();
      dayOfWeekCounts[d] += 1;
    });

    return {
      grossSales,
      validCount,
      totalCount,
      avgTicket,
      deliveryFees,
      cancelledCount,
      cancellationRate,
      lostRevenue,
      cancellationReasons,
      newCustCount,
      returningCustCount,
      deliveryOrders: deliveryOrders.length,
      pickupOrders: pickupOrders.length,
      deliveryTotal,
      pickupTotal,
      deliveryPct,
      pickupPct,
      paymentMap,
      topItems,
      timeSlots,
      dayOfWeekCounts,
    };
  }, [filteredOrders]);

  const maxDayCount = Math.max(1, ...stats.dayOfWeekCounts);

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Relatórios & Métricas</h2>
          <p className="text-xs text-zinc-400">
            Dados financeiros e operacionais calculados a partir dos pedidos reais
          </p>
        </div>

        {/* Period Filter Buttons */}
        <div className="flex items-center gap-1 bg-[#13161D] p-1 rounded-xl border border-zinc-800 text-xs overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setPeriod('hoje')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              period === 'hoje'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setPeriod('7dias')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              period === '7dias'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            7 Dias
          </button>
          <button
            type="button"
            onClick={() => setPeriod('30dias')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              period === '30dias'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            30 Dias
          </button>
          <button
            type="button"
            onClick={() => setPeriod('mes')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              period === 'mes'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Este Mês
          </button>
          <button
            type="button"
            onClick={() => setPeriod('personalizado')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              period === 'personalizado'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Personalizado
          </button>
        </div>
      </div>

      {/* Custom Date Pickers */}
      {period === 'personalizado' && (
        <div className="p-3.5 rounded-2xl bg-[#13161D] border border-zinc-800 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">De:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white font-mono focus:outline-hidden focus:border-orange-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Até:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white font-mono focus:outline-hidden focus:border-orange-500"
            />
          </div>
        </div>
      )}

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Gross Sales */}
        <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold text-zinc-300">Faturamento Bruto</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white tabular-nums">
            {formatCurrency(stats.grossSales)}
          </div>
          <p className="text-[11px] text-zinc-500">
            {stats.validCount} {stats.validCount === 1 ? 'pedido concluído' : 'pedidos concluídos'}
          </p>
        </div>

        {/* Avg Ticket */}
        <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold text-zinc-300">Ticket Médio</span>
            <TrendingUp className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-orange-400 tabular-nums">
            {formatCurrency(stats.avgTicket)}
          </div>
          <p className="text-[11px] text-zinc-500">Média por pedido válido</p>
        </div>

        {/* Delivery Fees Collected */}
        <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold text-zinc-300">Taxas de Entrega</span>
            <Bike className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-sky-400 tabular-nums">
            {formatCurrency(stats.deliveryFees)}
          </div>
          <p className="text-[11px] text-zinc-500">Arrecadadas no frete</p>
        </div>

        {/* Customers In Period */}
        <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-semibold text-zinc-300">Clientes Atendidos</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-purple-400 tabular-nums">
            {stats.newCustCount + stats.returningCustCount}
          </div>
          <p className="text-[11px] text-zinc-500">
            {stats.newCustCount} novos · {stats.returningCustCount} recorrentes
          </p>
        </div>
      </div>

      {/* Visual Charts: Day of Week & Hourly Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Orders by Day of Week */}
        <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-orange-400" />
              <span>Pedidos por Dia da Semana</span>
            </h3>
            <span className="text-[11px] text-zinc-400">{stats.validCount} pedidos</span>
          </div>

          <div className="grid grid-cols-7 gap-2 pt-4 items-end h-36">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, idx) => {
              const count = stats.dayOfWeekCounts[idx];
              const pct = (count / maxDayCount) * 100;

              return (
                <div key={day} className="flex flex-col items-center h-full justify-end group">
                  <span className="text-[10px] font-mono text-zinc-400 mb-1 group-hover:text-white">
                    {count}
                  </span>
                  <div className="w-full bg-zinc-900 rounded-t-lg h-24 flex items-end overflow-hidden p-0.5">
                    <div
                      className="w-full rounded-md transition-all duration-500 group-hover:brightness-125"
                      style={{
                        height: `${Math.max(8, pct)}%`,
                        backgroundColor: count > 0 ? '#FF5500' : '#27272a',
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-400 mt-1.5">{day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hourly Distribution */}
        <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-orange-400" />
              <span>Distribuição por Faixa Horária</span>
            </h3>
            <span className="text-[11px] text-zinc-400">Picos de demanda</span>
          </div>

          <div className="space-y-2.5 pt-2">
            {[
              { label: 'Almoço (11h - 14h)', count: stats.timeSlots.almoco, color: '#f59e0b' },
              { label: 'Tarde (14h - 18h)', count: stats.timeSlots.tarde, color: '#38bdf8' },
              { label: 'Noite / Jantar (18h - 23h)', count: stats.timeSlots.noite, color: '#FF5500' },
              { label: 'Madrugada / Manhã', count: stats.timeSlots.outros, color: '#71717a' },
            ].map(slot => {
              const pct = stats.validCount > 0 ? (slot.count / stats.validCount) * 100 : 0;

              return (
                <div key={slot.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300">{slot.label}</span>
                    <span className="font-mono text-zinc-400">
                      {slot.count} {slot.count === 1 ? 'pedido' : 'pedidos'} ({Math.round(pct)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: slot.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modality & Payment Methods Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Modality Breakdown */}
        <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-orange-400" />
              <span>Modalidade: Delivery vs Retirada</span>
            </h3>
            <span className="text-[11px] text-zinc-400">{stats.validCount} pedidos</span>
          </div>

          {/* Progress Bar */}
          <div className="h-3 w-full bg-zinc-900 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${stats.deliveryPct}%` }}
              className="bg-[#FF5500] h-full transition-all duration-500"
              title={`Delivery: ${stats.deliveryPct}%`}
            />
            <div
              style={{ width: `${stats.pickupPct}%` }}
              className="bg-sky-600 h-full transition-all duration-500"
              title={`Retirada: ${stats.pickupPct}%`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800/80">
              <div className="flex items-center gap-1.5 text-orange-400 font-semibold mb-1">
                <Bike className="w-4 h-4" />
                <span>Delivery ({stats.deliveryPct}%)</span>
              </div>
              <p className="font-mono font-bold text-white text-sm">
                {formatCurrency(stats.deliveryTotal)}
              </p>
              <span className="text-[11px] text-zinc-500">{stats.deliveryOrders} pedidos</span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800/80">
              <div className="flex items-center gap-1.5 text-sky-400 font-semibold mb-1">
                <Store className="w-4 h-4" />
                <span>Retirada ({stats.pickupPct}%)</span>
              </div>
              <p className="font-mono font-bold text-white text-sm">
                {formatCurrency(stats.pickupTotal)}
              </p>
              <span className="text-[11px] text-zinc-500">{stats.pickupOrders} pedidos</span>
            </div>
          </div>
        </div>

        {/* Payment Methods Breakdown */}
        <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-orange-400" />
              <span>Formas de Pagamento</span>
            </h3>
            <span className="text-[11px] text-zinc-400">Total Faturado</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* PIX */}
            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800">
              <div className="flex items-center justify-between text-teal-400 font-semibold mb-1">
                <span className="flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>PIX</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {stats.paymentMap.pix.count}x
                </span>
              </div>
              <span className="font-mono font-bold text-white text-sm">
                {formatCurrency(stats.paymentMap.pix.total)}
              </span>
            </div>

            {/* Crédito */}
            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800">
              <div className="flex items-center justify-between text-sky-400 font-semibold mb-1">
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Crédito</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {stats.paymentMap.cartao_credito.count}x
                </span>
              </div>
              <span className="font-mono font-bold text-white text-sm">
                {formatCurrency(stats.paymentMap.cartao_credito.total)}
              </span>
            </div>

            {/* Débito */}
            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800">
              <div className="flex items-center justify-between text-purple-400 font-semibold mb-1">
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Débito</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {stats.paymentMap.cartao_debito.count}x
                </span>
              </div>
              <span className="font-mono font-bold text-white text-sm">
                {formatCurrency(stats.paymentMap.cartao_debito.total)}
              </span>
            </div>

            {/* Dinheiro */}
            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800">
              <div className="flex items-center justify-between text-emerald-400 font-semibold mb-1">
                <span className="flex items-center gap-1">
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Dinheiro</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {stats.paymentMap.dinheiro.count}x
                </span>
              </div>
              <span className="font-mono font-bold text-white text-sm">
                {formatCurrency(stats.paymentMap.dinheiro.total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Selling Products Ranking */}
      <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-orange-400" />
            <span>Produtos Mais Vendidos</span>
          </h3>
          <span className="text-[11px] text-zinc-400">Ranking por volume</span>
        </div>

        {stats.topItems.length > 0 ? (
          <div className="space-y-2.5">
            {stats.topItems.map((item, idx) => (
              <div
                key={item.name}
                className="p-3 rounded-xl bg-[#0E1015] border border-zinc-850 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${
                      idx === 0
                        ? 'bg-amber-500 text-black'
                        : idx === 1
                        ? 'bg-zinc-300 text-black'
                        : idx === 2
                        ? 'bg-amber-700 text-white'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="font-semibold text-white">{item.name}</h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {item.quantity} {item.quantity === 1 ? 'unidade vendida' : 'unidades vendidas'}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-emerald-400 block">
                    {formatCurrency(item.total)}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">faturado</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 py-4 text-center">
            Nenhum produto vendido no período selecionado.
          </p>
        )}
      </div>

      {/* Cancellation Analysis Section */}
      <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Análise de Cancelamentos & Perdas</span>
          </h3>
          <span className="text-[11px] text-rose-400 font-semibold">
            {stats.cancellationRate.toFixed(1)}% taxa de cancelamento
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20">
            <span className="text-[10px] text-zinc-400 uppercase block">Pedidos Cancelados</span>
            <span className="text-lg font-bold font-mono text-rose-400">
              {stats.cancelledCount}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20">
            <span className="text-[10px] text-zinc-400 uppercase block">Valor Perdido</span>
            <span className="text-lg font-bold font-mono text-rose-400">
              {formatCurrency(stats.lostRevenue)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase block">Impacto no Faturamento</span>
            <span className="text-lg font-bold font-mono text-zinc-300">
              {stats.grossSales > 0
                ? `${((stats.lostRevenue / (stats.grossSales + stats.lostRevenue)) * 100).toFixed(1)}%`
                : '0.0%'}
            </span>
          </div>
        </div>

        {/* Motivos de cancelamento agrupados */}
        {stats.cancellationReasons.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-zinc-850">
            <span className="text-[11px] font-semibold text-zinc-400 block mb-1">
              Motivos apontados pelo estabelecimento/cliente:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {stats.cancellationReasons.map(r => (
                <div
                  key={r.reason}
                  className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between"
                >
                  <span className="text-zinc-300 truncate">{r.reason}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 font-mono text-[10px]">
                      {r.count}x
                    </span>
                    <span className="font-mono text-rose-400 font-semibold">
                      {formatCurrency(r.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
