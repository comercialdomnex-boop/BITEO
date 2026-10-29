import React, { useState } from 'react';
import { RestaurantProfile } from '../../types';
import { Button, Modal } from '../../components/shared';
import { formatPhoneMask } from '../../utils/phone';
import { NotificationSettingsModal } from '../components/NotificationSettingsModal';
import { PrinterSettingsModal } from '../components/PrinterSettingsModal';
import {
  Store,
  Clock,
  Volume2,
  VolumeX,
  Share2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Printer,
  Bell,
  Users,
  BarChart3,
  Ticket,
  ShieldCheck,
  CreditCard,
  Bike,
  Sparkles,
  HelpCircle,
  Settings,
  Layers,
  Phone,
  LogOut,
} from 'lucide-react';

interface MoreViewProps {
  restaurant: RestaurantProfile;
  onToggleStoreStatus: () => void;
  onChangeSoundAlerts: (enabled: boolean) => void;
  onOpenStorefront?: () => void;
  onOpenStoreSwitcher?: () => void;
  onLogout?: () => void;
  onNavigateToTab?: (
    tab: 'loja' | 'clientes' | 'relatorios' | 'pedidos' | 'cardapio'
  ) => void;
}

export const MoreView: React.FC<MoreViewProps> = ({
  restaurant,
  onToggleStoreStatus,
  onChangeSoundAlerts,
  onOpenStorefront,
  onOpenStoreSwitcher,
  onLogout,
  onNavigateToTab,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Mais Opções & Sistema</h2>
        <p className="text-xs text-zinc-400">
          Gerenciamento completo do restaurante, canais e preferências operacionais
        </p>
      </div>

      {/* Store Identity Card & Quick Status */}
      <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF5500] to-[#CC4400] flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-orange-950/40">
              B
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{restaurant.name}</h3>
              <p className="text-xs text-orange-400 font-medium">{restaurant.slogan}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">{restaurant.segment}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleStoreStatus}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              restaurant.isOpen
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            {restaurant.isOpen ? 'Loja Aberta' : 'Loja Fechada'}
          </button>
        </div>

        <div className="pt-3 border-t border-zinc-850 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
          <span className="truncate">📍 {restaurant.address}</span>
          {onOpenStorefront && (
            <button
              type="button"
              onClick={onOpenStorefront}
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 shrink-0"
            >
              <span>Ver Minha Loja Online</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* GROUP 1: MINHA OPERAÇÃO */}
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block px-1">
          Minha Operação
        </span>
        <div className="rounded-2xl bg-[#13161D] border border-zinc-800 divide-y divide-zinc-850 overflow-hidden text-xs">
          {/* Minha Loja */}
          <div
            onClick={() => onNavigateToTab?.('loja')}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-zinc-850/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Minha Loja Online</h4>
                <p className="text-[11px] text-zinc-400">
                  Logo, cores, banner, estilo visual e informações gerais
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </div>

          {/* Horários */}
          <div
            onClick={() => onNavigateToTab?.('loja')}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-zinc-850/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Horários de Funcionamento</h4>
                <p className="text-[11px] text-zinc-400">
                  Abertura semanal e turnos por dia da semana
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </div>

          {/* Entrega & Retirada */}
          <div
            onClick={() => onNavigateToTab?.('loja')}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-zinc-850/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
                <Bike className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Entrega & Retirada</h4>
                <p className="text-[11px] text-zinc-400">
                  Taxas de entrega, frete grátis e bairros atendidos
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </div>

          {/* Pagamentos */}
          <div
            onClick={() => onNavigateToTab?.('loja')}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-zinc-850/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Formas de Pagamento</h4>
                <p className="text-[11px] text-zinc-400">
                  PIX, cartões de crédito/débito e dinheiro na entrega
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </div>
        </div>
      </div>

      {/* GROUP 2: GESTÃO */}
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block px-1">
          Gestão
        </span>
        <div className="rounded-2xl bg-[#13161D] border border-zinc-800 divide-y divide-zinc-850 overflow-hidden text-xs">
          {/* Clientes */}
          <div
            onClick={() => onNavigateToTab?.('clientes')}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-zinc-850/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Clientes & Fidelidade</h4>
                <p className="text-[11px] text-zinc-400">
                  Histórico de pedidos, ticket médio e contato direto
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </div>

          {/* Relatórios */}
          <div
            onClick={() => onNavigateToTab?.('relatorios')}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-zinc-850/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Relatórios & Vendas</h4>
                <p className="text-[11px] text-zinc-400">
                  Faturamento, produtos mais vendidos e cancelamentos
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </div>

          {/* Cupons */}
          <div className="p-3.5 flex items-center justify-between opacity-80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-zinc-800 text-zinc-400">
                <Ticket className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-zinc-300">Cupons de Desconto</h4>
                <p className="text-[11px] text-zinc-500">Campanhas promocionais da loja</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
              Em breve
            </span>
          </div>

          {/* Usuários e Equipe */}
          <div className="p-3.5 flex items-center justify-between opacity-80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-zinc-800 text-zinc-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-zinc-300">Usuários e Equipe</h4>
                <p className="text-[11px] text-zinc-500">Perfis de acesso: Caixa, Cozinha, Admin</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
              Em breve
            </span>
          </div>
        </div>
      </div>

      {/* GROUP 3: SISTEMA */}
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block px-1">
          Sistema & Preferências
        </span>
        <div className="rounded-2xl bg-[#13161D] border border-zinc-800 divide-y divide-zinc-850 overflow-hidden text-xs">
          {/* Notificações */}
          <div
            onClick={() => setIsNotificationsModalOpen(true)}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-zinc-850/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Notificações & Sons</h4>
                <p className="text-[11px] text-zinc-400">
                  Sino de novos pedidos, alertas sonoros e visuais
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-orange-400 font-medium">
                {restaurant.soundAlertsEnabled ? 'Som Ativo' : 'Mudo'}
              </span>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </div>
          </div>

          {/* Impressão */}
          <div
            onClick={() => setIsPrinterModalOpen(true)}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-zinc-850/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Impressão de Comandas</h4>
                <p className="text-[11px] text-zinc-400">
                  Impressão automática, número de vias e preview 58mm/80mm
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </div>

          {/* Integrações */}
          <div className="p-3.5 flex items-center justify-between opacity-80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-zinc-800 text-zinc-400">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-zinc-300">Integrações Externas</h4>
                <p className="text-[11px] text-zinc-500">iFood, Anota AI, WhatsApp Bot e APIs</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
              Em breve
            </span>
          </div>
        </div>
      </div>

      {/* GROUP 4: CONTA & SUPORTE */}
      <div className="space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block px-1">
          Conta & Suporte
        </span>
        <div className="rounded-2xl bg-[#13161D] border border-zinc-800 divide-y divide-zinc-850 overflow-hidden text-xs">
          {/* Plano Biteo */}
          <div className="p-3.5 flex items-center justify-between opacity-80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-zinc-300">Plano Biteo Pro</h4>
                <p className="text-[11px] text-zinc-500">Taxa 0% por pedido · Cardápio ilimitado</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
              Ativo
            </span>
          </div>

          {/* Dados da Conta */}
          <div
            onClick={() => setIsAccountModalOpen(true)}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-zinc-850/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-zinc-800 text-zinc-300">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Dados do Estabelecimento</h4>
                <p className="text-[11px] text-zinc-400">CNPJ, Razão Social, E-mail e Telefone</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </div>

          {/* Ajuda */}
          <div
            onClick={() => setIsHelpModalOpen(true)}
            role="button"
            tabIndex={0}
            className="p-3.5 flex items-center justify-between hover:bg-zinc-850/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-zinc-800 text-zinc-300">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Ajuda & Central do Parceiro</h4>
                <p className="text-[11px] text-zinc-400">Tutoriais, dicas e suporte Biteo</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </div>

          {/* Meus Estabelecimentos */}
          {onOpenStoreSwitcher && (
            <div
              onClick={onOpenStoreSwitcher}
              role="button"
              tabIndex={0}
              className="p-3.5 flex items-center justify-between hover:bg-zinc-850/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Meus Estabelecimentos</h4>
                  <p className="text-[11px] text-zinc-400">
                    Alternar entre lojas ou criar novo estabelecimento
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </div>
          )}

          {/* Sair da Conta */}
          {onLogout && (
            <div
              onClick={onLogout}
              role="button"
              tabIndex={0}
              className="p-3.5 flex items-center justify-between hover:bg-rose-950/20 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 group-hover:bg-rose-500/25 transition-colors">
                  <LogOut className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-rose-300">Sair da Conta</h4>
                  <p className="text-[11px] text-zinc-500">
                    Encerrar sessão no dispositivo e voltar ao login
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-rose-500/50" />
            </div>
          )}
        </div>
      </div>

      {/* Share Store Link Box */}
      <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 text-xs">
        <div>
          <h4 className="font-bold text-white flex items-center gap-1.5">
            <Share2 className="w-4 h-4 text-orange-400" />
            <span>Link do Seu Cardápio Digital</span>
          </h4>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Compartilhe nas redes sociais e na bio do Instagram
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopyLink}
          className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
        >
          {copiedLink ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar Link</span>
            </>
          )}
        </button>
      </div>

      {/* Modals */}
      <NotificationSettingsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        restaurant={restaurant}
        onChangeSoundAlerts={onChangeSoundAlerts}
      />

      <PrinterSettingsModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
        restaurant={restaurant}
      />

      {/* Account Info Modal */}
      {isAccountModalOpen && (
        <Modal
          isOpen={isAccountModalOpen}
          onClose={() => setIsAccountModalOpen(false)}
          title="Dados do Estabelecimento"
          subtitle="Informações cadastrais no ecossistema Biteo"
          maxWidth="sm"
          footer={
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => setIsAccountModalOpen(false)}
            >
              Fechar
            </Button>
          }
        >
          <div className="space-y-3 text-xs text-zinc-300">
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                Nome Comercial
              </span>
              <p className="font-bold text-white">{restaurant.name}</p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                Segmento Principal
              </span>
              <p className="text-white">{restaurant.segment}</p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                Endereço
              </span>
              <p className="text-white">{restaurant.address}</p>
            </div>
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                WhatsApp de Atendimento
              </span>
              <p className="font-mono text-white">{formatPhoneMask(restaurant.whatsapp)}</p>
            </div>
          </div>
        </Modal>
      )}

      {/* Help Modal */}
      {isHelpModalOpen && (
        <Modal
          isOpen={isHelpModalOpen}
          onClose={() => setIsHelpModalOpen(false)}
          title="Central de Ajuda BITEO"
          subtitle="Dúvidas frequentes e suporte operacional"
          maxWidth="sm"
          footer={
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => setIsHelpModalOpen(false)}
            >
              Entendido
            </Button>
          }
        >
          <div className="space-y-3 text-xs text-zinc-300">
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
              <h4 className="font-bold text-white">Como recebo novos pedidos?</h4>
              <p className="text-[11px] text-zinc-400">
                Os pedidos feitos pelos clientes no seu cardápio digital chegam em tempo real no
                Dashboard de Pedidos com alerta sonoro e visual.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
              <h4 className="font-bold text-white">Como configurar a entrega?</h4>
              <p className="text-[11px] text-zinc-400">
                Acesse &ldquo;Minha Loja&rdquo; &rarr; aba &ldquo;Entrega &amp; Retirada&rdquo; para definir taxas fixas, bairros
                atendidos e meta para frete grátis.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
              <h4 className="font-bold text-white">Como imprimir comandas?</h4>
              <p className="text-[11px] text-zinc-400">
                Abra qualquer pedido e clique no botão &ldquo;Comanda&rdquo; para gerar a impressão no formato
                térmico 58mm ou 80mm.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
