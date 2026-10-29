import React, { useEffect, useRef, useState } from 'react';
import { StoreConfig, StoreInfo } from '../../../types';
import { formatPhoneMask, normalizePhone } from '../../../utils/phone';

interface InfoTabProps {
  config: StoreConfig;
  /**
   * Persists a partial change and resolves true only after the database
   * confirmed it. On false the local draft is kept so nothing typed is lost.
   */
  onUpdateInfo: (info: Partial<StoreInfo>) => Promise<boolean>;
  onSaveNotice: (msg: string) => void;
}

/**
 * Text field with a local draft committed on blur. The draft only resyncs when
 * the committed value actually changes (a real save), so a failed save keeps
 * whatever the merchant typed and lets them retry.
 */
const CommitTextField: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (value: string) => Promise<boolean>;
  transform?: (value: string) => string;
  textarea?: boolean;
  rows?: number;
  mono?: boolean;
  uppercase?: boolean;
  maxLength?: number;
  help?: string;
}> = ({
  label,
  value,
  placeholder,
  onCommit,
  transform,
  textarea = false,
  rows = 2,
  mono = false,
  uppercase = false,
  maxLength,
  help,
}) => {
  const [draft, setDraft] = useState(value);
  const [failed, setFailed] = useState(false);
  const lastValue = useRef(value);

  useEffect(() => {
    if (lastValue.current !== value) {
      lastValue.current = value;
      setDraft(value);
      setFailed(false);
    }
  }, [value]);

  const commit = async () => {
    const next = transform ? transform(draft) : draft;
    setDraft(next);
    if (next === value) {
      setFailed(false);
      return;
    }
    const ok = await onCommit(next);
    setFailed(!ok);
  };

  const baseClass = `w-full ${
    textarea ? 'p-3 resize-none' : 'h-10 px-3'
  } bg-[#0A0C0F] border rounded-xl text-xs sm:text-sm text-white focus:outline-none ${
    failed ? 'border-rose-500' : 'border-zinc-800 focus:border-orange-500'
  } ${mono ? 'font-mono' : ''} ${uppercase ? 'uppercase text-center' : ''}`;

  return (
    <div>
      <label className="block text-xs font-semibold text-white mb-1.5">{label}</label>
      {textarea ? (
        <textarea
          rows={rows}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          placeholder={placeholder}
          className={baseClass}
        />
      ) : (
        <input
          type="text"
          value={draft}
          maxLength={maxLength}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          placeholder={placeholder}
          className={baseClass}
        />
      )}
      {failed ? (
        <span className="text-[10px] text-rose-400 mt-1 block">
          Não foi possível salvar. Corrija e tente novamente.
        </span>
      ) : help ? (
        <span className="text-[10px] text-zinc-500 mt-1 block">{help}</span>
      ) : null}
    </div>
  );
};

/** Number field with the same draft/commit contract. */
const CommitNumberField: React.FC<{
  label: string;
  value: number;
  min?: number;
  max?: number;
  help?: string;
  onCommit: (value: number) => Promise<boolean>;
}> = ({ label, value, min, max, help, onCommit }) => {
  const [draft, setDraft] = useState(String(value));
  const [failed, setFailed] = useState(false);
  const lastValue = useRef(value);

  useEffect(() => {
    if (lastValue.current !== value) {
      lastValue.current = value;
      setDraft(String(value));
      setFailed(false);
    }
  }, [value]);

  const commit = async () => {
    const parsed = parseInt(draft, 10);
    const next = Number.isFinite(parsed) ? parsed : value;
    setDraft(String(next));
    if (next === value) {
      setFailed(false);
      return;
    }
    const ok = await onCommit(next);
    setFailed(!ok);
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-white mb-1.5">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        className={`w-full h-10 px-3 bg-[#0A0C0F] border rounded-xl text-xs sm:text-sm font-mono text-white focus:outline-none ${
          failed ? 'border-rose-500' : 'border-zinc-800 focus:border-orange-500'
        }`}
      />
      {failed ? (
        <span className="text-[10px] text-rose-400 mt-1 block">
          Não foi possível salvar. Corrija e tente novamente.
        </span>
      ) : help ? (
        <span className="text-[10px] text-zinc-500 mt-1 block">{help}</span>
      ) : null}
    </div>
  );
};

/**
 * The canonical value is always E.164, but re-normalizing on every keystroke
 * fights the caret and makes typing impossible. So while the field is being
 * edited we keep a local draft (masked for readability) and only commit the
 * canonical value on blur.
 */
const PhoneField: React.FC<{
  label: string;
  value: string;
  placeholder: string;
  onCommit: (canonical: string) => Promise<boolean>;
}> = ({ label, value, placeholder, onCommit }) => {
  const [draft, setDraft] = useState(() => formatPhoneMask(value));
  const [failed, setFailed] = useState(false);
  const lastValue = useRef(value);

  useEffect(() => {
    if (lastValue.current !== value) {
      lastValue.current = value;
      setDraft(formatPhoneMask(value));
      setFailed(false);
    }
  }, [value]);

  const commit = async () => {
    const canonical = normalizePhone(draft);
    if (canonical === value) {
      setFailed(false);
      return;
    }
    const ok = await onCommit(canonical);
    setFailed(!ok);
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-white mb-1.5">{label}</label>
      <input
        type="text"
        value={draft}
        onChange={e => setDraft(formatPhoneMask(e.target.value))}
        onBlur={commit}
        placeholder={placeholder}
        className={`w-full h-10 px-3 bg-[#0A0C0F] border rounded-xl text-xs sm:text-sm text-white font-mono focus:outline-none ${
          failed ? 'border-rose-500' : 'border-zinc-800 focus:border-orange-500'
        }`}
      />
      {failed && (
        <span className="text-[10px] text-rose-400 mt-1 block">
          Não foi possível salvar. Corrija e tente novamente.
        </span>
      )}
    </div>
  );
};

export const InfoTab: React.FC<InfoTabProps> = ({
  config,
  onUpdateInfo,
  onSaveNotice,
}) => {
  const { info } = config;

  const commitField = <K extends keyof StoreInfo>(field: K) => (
    value: StoreInfo[K]
  ) => onUpdateInfo({ [field]: value });

  return (
    <div className="space-y-6 text-zinc-200">
      {/* Basic Identity */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Dados Gerais da Loja
        </h3>

        <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CommitTextField
              label="Nome do Estabelecimento *"
              value={info.name}
              placeholder="Ex: Restaurante do bairro"
              onCommit={commitField('name')}
            />

            <CommitTextField
              label="Segmento / Categoria"
              value={info.category}
              placeholder="Ex: Hamburgueria & Pizzaria Artesanal"
              onCommit={commitField('category')}
            />
          </div>

          <CommitTextField
            label="Descrição Curta"
            value={info.description}
            placeholder="Descreva seu restaurante, especialidades e diferenciais..."
            onCommit={commitField('description')}
            textarea
          />
        </div>
      </div>

      {/* Operational Metrics: Minimum Order, Prep time, Delivery time */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Parâmetros de Pedido
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-[#13161D] border border-zinc-800">
          <CommitNumberField
            label="Tempo Médio de Preparo (min)"
            value={info.averagePrepTimeMin}
            min={5}
            max={180}
            help="Média na cozinha"
            onCommit={commitField('averagePrepTimeMin')}
          />

          <CommitTextField
            label="Estimativa de Entrega"
            value={info.averageDeliveryTimeMin}
            placeholder="Ex: 35 - 50 min"
            help="Exibido no banner da loja"
            onCommit={commitField('averageDeliveryTimeMin')}
          />
        </div>
      </div>

      {/* Contact & Address */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Contato & Localização
        </h3>

        <div className="p-4 rounded-2xl bg-[#13161D] border border-zinc-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PhoneField
              label="Telefone de Contato"
              value={info.phone}
              placeholder="(11) 3456-7890"
              onCommit={commitField('phone')}
            />

            <PhoneField
              label="WhatsApp Comercial (Notificações)"
              value={info.whatsapp}
              placeholder="(11) 98765-4321"
              onCommit={commitField('whatsapp')}
            />
          </div>

          <CommitTextField
            label="Endereço Completo (Rua, Número, Bairro)"
            value={info.address}
            placeholder="Av. Paulista, 1578 - Bela Vista"
            onCommit={commitField('address')}
          />

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <CommitTextField
                label="Cidade"
                value={info.city}
                placeholder="São Paulo"
                onCommit={commitField('city')}
              />
            </div>

            <div className="col-span-1">
              <CommitTextField
                label="Estado (UF)"
                value={info.state}
                placeholder="SP"
                maxLength={2}
                uppercase
                transform={v => v.toUpperCase()}
                onCommit={commitField('state')}
              />
            </div>

            <div className="col-span-1">
              <CommitTextField
                label="CEP"
                value={info.zipCode}
                placeholder="01310-200"
                mono
                onCommit={commitField('zipCode')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
