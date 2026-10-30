import React, { useState } from 'react';
import { StoreConfig, StoreOnlineSettings } from '../../../types';
import { Button } from '../../../components/shared';
import { QRCodeDisplay } from '../../../components/shared/QRCodeDisplay';
import {
  Globe,
  Share2,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Download,
  Printer,
  Sparkles,
} from 'lucide-react';

interface OnlineStoreTabProps {
  config: StoreConfig;
  onUpdateOnline: (online: Partial<StoreOnlineSettings>) => void;
  onOpenStorefront?: () => void;
  onSaveNotice: (msg: string) => void;
  publicationSaving?: boolean;
}

export const OnlineStoreTab: React.FC<OnlineStoreTabProps> = ({
  config,
  onUpdateOnline,
  onOpenStorefront,
  onSaveNotice,
  publicationSaving = false,
}) => {
  const { online, info } = config;

  const [copiedLink, setCopiedLink] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Slug editing state
  const [tempSlug, setTempSlug] = useState(online.slug);
  const [isEditingSlug, setIsEditingSlug] = useState(false);

  const fullStoreUrl = `https://biteo.com.br/${online.slug}`;

  // Validate slug rules: only lowercase letters, numbers, and hyphens, 3 to 40 chars
  const validateSlug = (val: string) => {
    if (!val) return { isValid: false, message: 'O endereço não pode ficar vazio.' };
    if (val.length < 3) return { isValid: false, message: 'Mínimo de 3 caracteres.' };
    if (val.length > 40) return { isValid: false, message: 'Máximo de 40 caracteres.' };
    const regex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!regex.test(val)) {
      return {
        isValid: false,
        message: 'Apenas letras minúsculas, números e hífens (sem espaços ou acentos).',
      };
    }
    return { isValid: true, message: 'Endereço disponível para uso!' };
  };

  const validation = validateSlug(tempSlug);

  const handleSaveSlug = () => {
    if (!validation.isValid) return;
    onUpdateOnline({ slug: tempSlug });
    setIsEditingSlug(false);
    onSaveNotice(`Novo endereço salvo: biteo.com.br/${tempSlug}`);
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(fullStoreUrl);
    setCopiedLink(true);
    onSaveNotice('Link da loja copiado para a área de transferência!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: info.name,
          text: `Confira o cardápio online do ${info.name} no BITEO:`,
          url: fullStoreUrl,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    handleCopyLink();
  };

  return (
    <div className="space-y-6 text-zinc-200">
      {/* Store Published Status Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#121620] to-[#161B26] border border-orange-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-orange-400 shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base">
                Loja Pública Biteo
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${online.isPublished ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>
                {online.isPublished ? 'Loja publicada' : 'Loja não publicada'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {online.isPublished ? "O cardápio está publicado. A abertura e o fechamento são controlados pelo botão no cabeçalho." : "Use Abrir loja no cabeçalho para publicar o cardápio e ativar o recebimento de pedidos."}
            </p>
          </div>
        </div>

        {/* Publication is managed by the single Open/Close control in Merchant header. */}
        {/* Quick Open Storefront Button */}
        {onOpenStorefront && (
          <Button
            variant="primary"
            size="md"
            leftIcon={<ExternalLink className="w-4 h-4" />}
            onClick={onOpenStorefront}
            className="shrink-0"
          >
            Visualizar Loja
          </Button>
        )}
      </div>

      {/* URL & Slug Customization */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Endereço Web Exclusivo
        </h3>

        <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
          <label className="block text-xs font-semibold text-white">
            Link do Cardápio Digital (Slug)
          </label>

          {!isEditingSlug ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#0A0C0F] border border-zinc-800">
              <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-300 truncate">
                <span className="text-zinc-500">https://biteo.com.br/</span>
                <strong className="text-orange-400">{online.slug}</strong>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setTempSlug(online.slug);
                    setIsEditingSlug(true);
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Alterar Link
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-3.5 rounded-xl bg-[#0A0C0F] border border-orange-500/40 animate-in fade-in">
              <div className="flex items-center gap-1.5 bg-[#141720] border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono">
                <span className="text-zinc-500">biteo.com.br/</span>
                <input
                  type="text"
                  value={tempSlug}
                  onChange={e =>
                    setTempSlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                    )
                  }
                  placeholder="sua-loja"
                  className="flex-1 bg-transparent text-orange-400 font-bold focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Real-time Visual Validation Feedback */}
              <div className="flex items-center gap-2 text-xs">
                {validation.isValid ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <Check className="w-3.5 h-3.5" />
                    <span>{validation.message}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-400 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{validation.message}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!validation.isValid}
                  onClick={handleSaveSlug}
                >
                  Confirmar Novo Endereço
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingSlug(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Share & QR Code Actions */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Divulgação & QR Code
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Share Card */}
          <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Compartilhar Loja</h4>
                <p className="text-xs text-zinc-400">
                  Envie no WhatsApp, Instagram e Bio das redes sociais
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Share2 className="w-3.5 h-3.5" />}
                onClick={handleShare}
                fullWidth
              >
                Compartilhar Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Copy className="w-3.5 h-3.5" />}
                onClick={handleCopyLink}
              >
                Copiar
              </Button>
            </div>
          </div>

          {/* QR Code Card */}
          <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">QR Code de Balcão e Mesa</h4>
                <p className="text-xs text-zinc-400">
                  Gere o código para imprimir e colocar nas mesas ou display
                </p>
              </div>
            </div>

            <div className="pt-1">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<QrCode className="w-3.5 h-3.5 text-sky-400" />}
                onClick={() => setShowQRModal(true)}
                fullWidth
              >
                Abrir & Baixar QR Code
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal Display */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm bg-[#13161D] border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                QR Code Oficial da Loja
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Aponte a câmera do celular para abrir o cardápio
              </p>
            </div>

            {/* Generated QR Code Graphic */}
            <div className="p-2 bg-white rounded-3xl shadow-xl">
              <QRCodeDisplay
                url={fullStoreUrl}
                size={200}
                logoText={info.name.charAt(0) || 'B'}
              />
            </div>

            <div className="text-xs font-mono text-zinc-400 truncate max-w-full">
              {fullStoreUrl}
            </div>

            <div className="flex items-center gap-2 w-full pt-2">
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Printer className="w-4 h-4" />}
                onClick={() => {
                  window.print();
                }}
                className="flex-1"
              >
                Imprimir
              </Button>

              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  handleCopyLink();
                  setShowQRModal(false);
                }}
                className="flex-1"
              >
                Copiar Link
              </Button>
            </div>

            <button
              type="button"
              onClick={() => setShowQRModal(false)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
