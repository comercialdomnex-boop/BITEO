import React, { useState, useMemo } from 'react';
import { Customer, Order } from '../../types';
import { CustomerService } from '../../services/customerService';
import { CustomerDetailModal } from '../components/CustomerDetailModal';
import { SearchInput, formatCurrency, formatTimeAgo, StatCard } from '../../components/shared';
import {
  buildWhatsAppUrl,
  buildTelUrl,
  formatPhoneMask,
  phoneIdentity,
} from '../../utils/phone';
import { fromCents, sumCents } from '../../utils/money';
import {
  Users,
  UserCheck,
  UserPlus,
  TrendingUp,
  MessageSquare,
  Phone,
  Bike,
  Store,
  ChevronRight,
  ArrowUpDown,
  Filter,
  ShoppingBag,
  Heart,
  MapPin,
} from 'lucide-react';

interface CustomersViewProps {
  orders: Order[];
  onSelectOrder?: (order: Order) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  orders,
  onSelectOrder,
}) => {
  // Derive customers directly from orders state
  const customers = useMemo(() => {
    return CustomerService.deriveFromOrders(orders);
  }, [orders]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'novo' | 'recorrente'>('todos');
  const [sortBy, setSortBy] = useState<'recentes' | 'pedidos' | 'gasto'>('recentes');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Top Metrics
  const metrics = useMemo(() => {
    const total = customers.length;
    const novos = customers.filter(c => c.status === 'novo').length;
    const recorrentes = customers.filter(c => c.status === 'recorrente').length;
    const totalGastoCents = sumCents(customers.map(c => c.totalSpent));
    const ticketMedio = total > 0 ? fromCents(Math.round(totalGastoCents / total)) : 0;

    return { total, novos, recorrentes, ticketMedio };
  }, [customers]);

  // Filtered & Sorted list
  const filteredCustomers = useMemo(() => {
    return customers
      .filter(c => {
        // Status filter
        if (statusFilter !== 'todos' && c.status !== statusFilter) {
          return false;
        }

        // Search query
        if (searchQuery.trim().length > 0) {
          const q = searchQuery.toLowerCase().trim();
          const matchesName = c.name.toLowerCase().includes(q);
          const queryDigits = q.replace(/\D/g, '');
          const matchesPhone =
            queryDigits.length > 0 && phoneIdentity(c.phone).includes(queryDigits);
          const matchesAddress = c.addresses
            ? c.addresses.some(a => a.toLowerCase().includes(q))
            : false;
          return matchesName || matchesPhone || matchesAddress;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'pedidos') {
          return b.totalOrders - a.totalOrders;
        }
        if (sortBy === 'gasto') {
          return b.totalSpent - a.totalSpent;
        }
        // 'recentes'
        return new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime();
      });
  }, [customers, statusFilter, searchQuery, sortBy]);

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Base de Clientes</h2>
          <p className="text-xs text-zinc-400">
            Inteligência de consumo, fidelidade e histórico derivados dos pedidos
          </p>
        </div>
      </div>

      {/* Top Indicators Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard
          label="Total de Clientes"
          count={metrics.total}
          icon={<Users className="w-4 h-4 text-orange-400" />}
          subtext="Base total cadastrada"
          highlightColor="orange"
        />

        <StatCard
          label="Novos Clientes"
          count={metrics.novos}
          icon={<UserPlus className="w-4 h-4 text-emerald-400" />}
          subtext="1 pedido realizado"
          highlightColor="emerald"
        />

        <StatCard
          label="Recorrentes"
          count={metrics.recorrentes}
          icon={<UserCheck className="w-4 h-4 text-amber-400" />}
          subtext="2 ou mais pedidos"
          highlightColor="amber"
        />

        <div className="p-3.5 rounded-2xl bg-[#13161D] border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span className="font-semibold text-zinc-300">Ticket Médio / Cliente</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white tabular-nums">
            {formatCurrency(metrics.ticketMedio)}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1">Gasto médio acumulado</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="flex-1 w-full">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar por nome, WhatsApp ou endereço..."
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 ml-1.5" />
            <button
              type="button"
              onClick={() => setSortBy('recentes')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                sortBy === 'recentes'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Recentes
            </button>
            <button
              type="button"
              onClick={() => setSortBy('pedidos')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                sortBy === 'pedidos'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Mais Pedidos
            </button>
            <button
              type="button"
              onClick={() => setSortBy('gasto')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                sortBy === 'gasto'
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Maior Gasto
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-800/80 text-xs">
          <span className="text-zinc-500 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" />
            <span>Filtro:</span>
          </span>

          <button
            type="button"
            onClick={() => setStatusFilter('todos')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors ${
              statusFilter === 'todos'
                ? 'bg-zinc-700 text-white'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            Todos ({customers.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('novo')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors ${
              statusFilter === 'novo'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-900 text-emerald-400 hover:text-emerald-300 border border-zinc-800'
            }`}
          >
            Novos ({metrics.novos})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('recorrente')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors ${
              statusFilter === 'recorrente'
                ? 'bg-amber-600 text-white'
                : 'bg-zinc-900 text-amber-400 hover:text-amber-300 border border-zinc-800'
            }`}
          >
            Recorrentes ({metrics.recorrentes})
          </button>
        </div>
      </div>

      {/* Customers List */}
      {filteredCustomers.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredCustomers.map(customer => {
            const waUrl = buildWhatsAppUrl(customer.phone);
            const telUrl = buildTelUrl(customer.phone);

            return (
              <div
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    setSelectedCustomer(customer);
                  }
                }}
                className="p-4 rounded-2xl bg-[#13161D] hover:bg-[#161a24] border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
              >
                {/* Header: Name, Status & WhatsApp quick button */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white group-hover:text-orange-400 transition-colors truncate">
                        {customer.name}
                      </h4>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                          customer.status === 'recorrente'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {customer.status === 'recorrente' ? 'Recorrente' : 'Novo'}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                      {formatPhoneMask(customer.phone)}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                      Bairro: <strong className="text-zinc-300">{customer.neighborhood}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-500/30 transition-colors"
                      title="Chamar no WhatsApp"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </a>
                    <a
                      href={telUrl}
                      className="p-2 rounded-xl bg-zinc-850 hover:bg-zinc-750 text-zinc-300 border border-zinc-750 transition-colors"
                      title="Ligar"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-[#0E1015] rounded-xl border border-zinc-850 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase">Pedidos</span>
                    <span className="font-bold text-white font-mono">{customer.totalOrders}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase">Total Gasto</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {formatCurrency(customer.totalSpent)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase">Ticket Médio</span>
                    <span className="font-bold text-orange-400 font-mono">
                      {formatCurrency(
                        customer.averageTicket ??
                          (customer.totalOrders > 0
                            ? customer.totalSpent / customer.totalOrders
                            : 0)
                      )}
                    </span>
                  </div>
                </div>

                {/* Footer details: Modality, Last order time and View details chevron */}
                <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-850/80">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      {customer.preferredModality === 'delivery' ? (
                        <>
                          <Bike className="w-3.5 h-3.5 text-orange-400" />
                          <span>Delivery</span>
                        </>
                      ) : (
                        <>
                          <Store className="w-3.5 h-3.5 text-sky-400" />
                          <span>Retirada</span>
                        </>
                      )}
                    </span>
                    <span>·</span>
                    <span>Último: {formatTimeAgo(customer.lastOrderDate)}</span>
                  </div>

                  <span className="text-orange-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>Ver Histórico</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 px-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
          <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Nenhum cliente encontrado</h4>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              {searchQuery.trim()
                ? `Nenhum resultado corresponde à busca "${searchQuery}". Tente outros termos.`
                : 'Quando os clientes fizerem pedidos na sua loja, eles aparecerão automaticamente aqui com métricas completas.'}
            </p>
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('todos');
              }}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Limpar Filtros de Busca
            </button>
          )}
        </div>
      )}

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          isOpen={Boolean(selectedCustomer)}
          onClose={() => setSelectedCustomer(null)}
          onSelectOrder={order => {
            setSelectedCustomer(null);
            if (onSelectOrder) {
              onSelectOrder(order);
            }
          }}
        />
      )}
    </div>
  );
};
