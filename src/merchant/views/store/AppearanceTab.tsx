import React, { useState } from 'react';
import { StoreConfig, StoreTheme, StoreVisualTheme } from '../../../types';
import { Button } from '../../../components/shared';
import {
  Upload,
  Image as ImageIcon,
  Palette,
  Sparkles,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';

interface AppearanceTabProps {
  config: StoreConfig;
  onUpdateTheme: (theme: Partial<StoreTheme>) => void;
  onSaveNotice: (msg: string) => void;
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
  config,
  onUpdateTheme,
  onSaveNotice,
}) => {
  const { theme } = config;

  const colorPresets = [
    { label: 'Laranja Biteo', hex: '#FF5500' },
    { label: 'Coral', hex: '#E11D48' },
    { label: 'Verde Esmeralda', hex: '#059669' },
    { label: 'Azul Elétrico', hex: '#2563EB' },
    { label: 'Roxo Moderno', hex: '#7C3AED' },
    { label: 'Âmbar Dourado', hex: '#D97706' },
    { label: 'Preto & Grafite', hex: '#27272A' },
  ];

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'logoUrl' | 'bannerUrl'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          onUpdateTheme({ [field]: reader.result });
          onSaveNotice(
            field === 'logoUrl' ? 'Logo atualizado!' : 'Capa atualizada!'
          );
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 text-zinc-200">
      {/* Visual Identity Note */}
      <div className="p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-xs text-orange-200 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          As cores e o estilo configurados abaixo personalizam <strong>exclusivamente a Loja Pública do Consumidor</strong>. O painel administrativo mantém a identidade oficial BITEO.
        </p>
      </div>

      {/* Logo & Banner Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Imagens da Loja
        </h3>

        {/* Logo Configuration */}
        <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
          <label className="block text-xs font-semibold text-white">
            Logo do Estabelecimento
          </label>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div
              className="w-20 h-20 rounded-2xl border-2 border-zinc-700/80 shadow-md shrink-0 overflow-hidden flex items-center justify-center text-white font-extrabold text-xl relative group"
              style={{ backgroundColor: theme.primaryColor }}
            >
              {theme.logoUrl ? (
                <img
                  src={theme.logoUrl}
                  alt="Logo da loja"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{config.info.name.charAt(0) || 'B'}</span>
              )}

              {theme.logoUrl && (
                <button
                  type="button"
                  onClick={() => onUpdateTheme({ logoUrl: '' })}
                  className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                  title="Remover logo"
                >
                  <X className="w-5 h-5 text-rose-400" />
                </button>
              )}
            </div>

            <div className="space-y-2 flex-1 w-full">
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium rounded-xl border border-zinc-700 transition-colors">
                  <Upload className="w-3.5 h-3.5 text-orange-400" />
                  <span>Fazer upload de logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleFileUpload(e, 'logoUrl')}
                    className="hidden"
                  />
                </label>

                {theme.logoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateTheme({ logoUrl: '' });
                      onSaveNotice('Logo removido.');
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300"
                  >
                    Remover logo
                  </button>
                )}
              </div>

              <input
                type="text"
                value={theme.logoUrl || ''}
                onChange={e => onUpdateTheme({ logoUrl: e.target.value })}
                placeholder="Ou cole a URL direta da imagem do logo..."
                className="w-full h-9 px-3 bg-[#0A0C0F] border border-zinc-800 text-zinc-200 placeholder-zinc-600 text-xs rounded-xl focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Banner / Cover Configuration */}
        <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-white">
              Imagem de Capa (Banner Principal)
            </label>
            <span className="text-[11px] text-zinc-500">Recomendado: 1200 x 400px</span>
          </div>

          <div className="relative w-full h-32 sm:h-36 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center">
            {theme.bannerUrl ? (
              <img
                src={theme.bannerUrl}
                alt="Banner de capa"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-600 text-xs">
                <ImageIcon className="w-8 h-8 mb-1 text-zinc-700" />
                <span>Nenhuma capa definida</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
          </div>

          {/* Action Row & Preset Banners */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-medium rounded-xl border border-zinc-700 transition-colors">
                <Upload className="w-3.5 h-3.5 text-orange-400" />
                <span>Upload de foto de capa</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => handleFileUpload(e, 'bannerUrl')}
                  className="hidden"
                />
              </label>

              {theme.bannerUrl && (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateTheme({ bannerUrl: '' });
                    onSaveNotice('Capa removida.');
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300"
                >
                  Remover capa
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Colors Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Cores da Loja
        </h3>

        <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-4">
          {/* Primary Color */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white">
                Cor Principal (Botões, Destaques e Badges)
              </label>
              <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-300">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/20"
                  style={{ backgroundColor: theme.primaryColor }}
                />
                <span>{theme.primaryColor}</span>
              </div>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {colorPresets.map(preset => {
                const isSelected =
                  theme.primaryColor.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => {
                      onUpdateTheme({ primaryColor: preset.hex });
                      onSaveNotice(`Cor principal alterada para ${preset.label}`);
                    }}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-white bg-zinc-800/80 shadow-md'
                        : 'border-zinc-800 bg-[#0E1015] hover:border-zinc-700'
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-full shadow-inner border border-white/10 flex items-center justify-center text-white"
                      style={{ backgroundColor: preset.hex }}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </span>
                    <span className="text-[10px] text-zinc-400 truncate max-w-[60px]">
                      {preset.label.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom Hex input */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-zinc-400">Personalizado:</span>
              <div className="relative flex items-center">
                <input
                  type="color"
                  value={theme.primaryColor}
                  onChange={e => onUpdateTheme({ primaryColor: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
              </div>
              <input
                type="text"
                value={theme.primaryColor}
                onChange={e => onUpdateTheme({ primaryColor: e.target.value })}
                className="w-24 h-8 px-2 bg-[#0A0C0F] border border-zinc-800 text-xs font-mono text-white rounded-lg focus:outline-none focus:border-orange-500 uppercase"
              />
            </div>
          </div>

          {/* Secondary Color */}
          <div className="pt-3 border-t border-zinc-850 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white">
                Cor Secundária (Superfícies e Detalhes)
              </label>
              <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-300">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/20"
                  style={{ backgroundColor: theme.secondaryColor }}
                />
                <span>{theme.secondaryColor}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.secondaryColor}
                onChange={e => onUpdateTheme({ secondaryColor: e.target.value })}
                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
              />
              <input
                type="text"
                value={theme.secondaryColor}
                onChange={e => onUpdateTheme({ secondaryColor: e.target.value })}
                className="w-24 h-8 px-2 bg-[#0A0C0F] border border-zinc-800 text-xs font-mono text-white rounded-lg focus:outline-none focus:border-orange-500 uppercase"
              />
              <button
                type="button"
                onClick={() => onUpdateTheme({ secondaryColor: '#1B202A' })}
                className="text-xs text-zinc-400 hover:text-white underline ml-2"
              >
                Restaurar padrão escuro
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Style Options */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Estilo Visual da Loja
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Moderno */}
          <div
            onClick={() => {
              onUpdateTheme({ visualStyle: 'moderno' });
              onSaveNotice('Estilo visual alterado para Moderno');
            }}
            className={`p-4 rounded-2xl border cursor-pointer select-none transition-all ${
              theme.visualStyle === 'moderno'
                ? 'border-orange-500 bg-orange-500/10 shadow-lg'
                : 'border-zinc-800 bg-[#13161D] hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-white">Moderno</span>
              {theme.visualStyle === 'moderno' && (
                <span className="w-5 h-5 rounded-full bg-[#FF5500] text-white flex items-center justify-center text-xs">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Cards com bordas arredondadas (rounded-2xl), sombras leves e visual equilibrado de alta conversão.
            </p>
          </div>

          {/* Minimalista */}
          <div
            onClick={() => {
              onUpdateTheme({ visualStyle: 'minimalista' });
              onSaveNotice('Estilo visual alterado para Minimalista');
            }}
            className={`p-4 rounded-2xl border cursor-pointer select-none transition-all ${
              theme.visualStyle === 'minimalista'
                ? 'border-orange-500 bg-orange-500/10 shadow-lg'
                : 'border-zinc-800 bg-[#13161D] hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-white">Minimalista</span>
              {theme.visualStyle === 'minimalista' && (
                <span className="w-5 h-5 rounded-full bg-[#FF5500] text-white flex items-center justify-center text-xs">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Linhas retas elegantes (rounded-lg), alto contraste com foco estrito na fotografia e no produto.
            </p>
          </div>

          {/* Vibrante */}
          <div
            onClick={() => {
              onUpdateTheme({ visualStyle: 'vibrante' });
              onSaveNotice('Estilo visual alterado para Vibrante');
            }}
            className={`p-4 rounded-2xl border cursor-pointer select-none transition-all ${
              theme.visualStyle === 'vibrante'
                ? 'border-orange-500 bg-orange-500/10 shadow-lg'
                : 'border-zinc-800 bg-[#13161D] hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-white">Vibrante</span>
              {theme.visualStyle === 'vibrante' && (
                <span className="w-5 h-5 rounded-full bg-[#FF5500] text-white flex items-center justify-center text-xs">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Bordas expressivas (rounded-3xl), cores em alta saturação e botões com grande destaque tátil.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
