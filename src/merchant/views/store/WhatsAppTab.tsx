import React from 'react';
import { MessageCircle, LockKeyhole, CheckCircle2 } from 'lucide-react';

interface WhatsAppTabProps {
  storeName: string;
}

/**
 * Configuration landing page only. Embedded Signup, OAuth callback, encrypted
 * credential storage and verified webhook are intentionally NOT wired yet.
 */
export const WhatsAppTab: React.FC<WhatsAppTabProps> = ({ storeName }) => (
  <div className="rounded-2xl border border-zinc-800 bg-[#13161D] p-5 space-y-5">
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
        <MessageCircle className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-bold text-white">WhatsApp Business oficial</h2>
        <p className="text-xs text-zinc-400">
          Configure o número da sua loja para enviar atualizações de pedidos pela API oficial da Meta.
        </p>
      </div>
    </div>

    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
      <p className="text-xs font-semibold text-amber-300">Integração em preparação — não conectada</p>
      <p className="text-xs text-zinc-300">
        A loja {storeName || 'atual'} ainda não possui conexão ativa nesta versão.
        Nenhuma mensagem automática será enviada.
      </p>
    </div>

    <div className="space-y-3 text-xs text-zinc-300">
      <div className="flex items-start gap-2">
        <LockKeyhole className="w-4 h-4 shrink-0 text-emerald-400" />
        <span>O acesso será autorizado pelo fluxo oficial da Meta. Nunca informe senha ou token nesta tela.</span>
      </div>
      <div className="flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
        <span>Notificações previstas: pagamento confirmado, pedido em preparo e pedido pronto.</span>
      </div>
      <div className="flex items-start gap-2">
        <MessageCircle className="w-4 h-4 shrink-0 text-emerald-400" />
        <span>O cliente precisará autorizar o recebimento das mensagens no checkout. Modelos devem ser aprovados pela Meta; tarifas podem ser aplicadas.</span>
      </div>
    </div>

    <button type="button" disabled className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-xs font-semibold text-zinc-400 cursor-not-allowed">
      Conectar WhatsApp Business — em breve
    </button>
    <p className="text-[11px] text-zinc-500">
      A conexão ficará disponível somente após implantação segura do backend, revisão de permissões e configuração do aplicativo Meta.
    </p>
  </div>
);
