import React, { useState } from 'react';
import { Button, formatCurrency } from '../components/shared';
import { SessionService } from '../services/sessionService';
import { digitsOnly } from '../utils/phone';
import { StoreInstance } from '../types';
import { useAuth } from '../auth/AuthProvider';
import { toFriendlyStoreCreationError } from '../auth/errors';
import {
  buildStoreInstanceFromRow,
  createFirstStore,
  STORE_SLUG_MAX_LENGTH,
  STORE_SLUG_MIN_LENGTH,
  STORE_SLUG_REGEX,
} from '../services/storeCreationService';
import {
  Store,
  MapPin,
  Bike,
  Palette,
  Globe,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Check,
  X,
  Clock,
  DollarSign,
  Phone,
  Eye,
  ShoppingBag,
} from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: (store: StoreInstance, targetView: 'merchant' | 'storefront') => void;
  onCancel?: () => void;
  userInitialName?: string;
}

const CATEGORIES = [
  'Hamburgueria',
  'Pizzaria',
  'Restaurante',
  'Açaí',
  'Lanchonete',
  'Doceria',
  'Padaria',
  'Japonesa',
  'Marmitaria',
  'Outros',
];

const PRESET_COLORS = [
  { name: 'Laranja Biteo', hex: '#FF5500' },
  { name: 'Vermelho Brasa', hex: '#EF4444' },
  { name: 'Âmbar Dourado', hex: '#F59E0B' },
  { name: 'Esmeralda Fresh', hex: '#10B981' },
  { name: 'Azul Elétrico', hex: '#3B82F6' },
  { name: 'Roxo Moderno', hex: '#8B5CF6' },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onComplete,
  onCancel,
  userInitialName = '',
}) => {
  const { currentUser } = useAuth();

  // 0 = Boas-vindas / Primeiro Acesso screen (Step 5)
  // 1 = Negócio, 2 = Endereço, 3 = Operação, 4 = Identidade, 5 = Loja Online, 6 = Conclusão
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0);

  // Form States - preserved across back/next navigation.
  // Every field starts empty: the wizard must not invent the merchant's data.
  const [businessName, setBusinessName] = useState(userInitialName || '');
  const [category, setCategory] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [phone, setPhone] = useState('');

  // Endereço
  const [zipCode, setZipCode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Operação
  const [allowDelivery, setAllowDelivery] = useState(true);
  const [allowPickup, setAllowPickup] = useState(true);
  const [fixedFee, setFixedFee] = useState<number>(0);
  const [minimumOrderValue, setMinimumOrderValue] = useState<number>(0);
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState('');
  const [estimatedPickupTime, setEstimatedPickupTime] = useState('');

  // Identidade
  const [primaryColor, setPrimaryColor] = useState('#FF5500');
  const [visualStyle, setVisualStyle] = useState<'moderno' | 'minimalista' | 'vibrante'>('moderno');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  // Loja Online
  const [slug, setSlug] = useState('');
  const [isSlugCustomized, setIsSlugCustomized] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [createdStore, setCreatedStore] = useState<StoreInstance | null>(null);
  // Real registration state: the RPC is in-flight and the last real failure.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Auto-generate slug from business name if user hasn't explicitly edited it
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleBusinessNameChange = (val: string) => {
    setBusinessName(val);
    if (!isSlugCustomized) {
      setSlug(generateSlug(val));
    }
  };

  // Step 1 Validation
  const validateStep1 = () => {
    const errs: { [key: string]: string } = {};
    if (!businessName.trim() || businessName.trim().length < 3) {
      errs.name = 'Informe o nome do estabelecimento (mínimo 3 letras)';
    }
    if (!category) {
      errs.category = 'Selecione o segmento principal';
    }
    const cleanPhone = digitsOnly(whatsapp);
    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      errs.whatsapp = 'Informe um WhatsApp comercial válido com DDD';
    }
    // The RPC only accepts E.164; a partial landline would be rejected there.
    const cleanLandline = digitsOnly(phone);
    if (phone.trim() && (cleanLandline.length < 10 || cleanLandline.length > 13)) {
      errs.phone = 'Informe um telefone válido com DDD ou deixe em branco';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Step 2 Validation
  const validateStep2 = () => {
    const errs: { [key: string]: string } = {};
    if (!zipCode.trim()) errs.zipCode = 'Informe o CEP';
    if (!street.trim()) errs.street = 'Informe a rua ou avenida';
    if (!number.trim()) errs.number = 'Informe o número';
    if (!neighborhood.trim()) errs.neighborhood = 'Informe o bairro';
    if (!city.trim()) errs.city = 'Informe a cidade';
    if (!state.trim()) errs.state = 'Informe a UF';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Step 3 Validation
  const validateStep3 = () => {
    const errs: { [key: string]: string } = {};
    if (!allowDelivery && !allowPickup) {
      errs.operation = 'Selecione ao menos uma forma de atendimento (Delivery ou Retirada)';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Step 5: validate the link and register the store through the real RPC.
  // The store only appears on success; any database error stays on this step.
  const handleCreateStore = async () => {
    if (isSubmitting) return; // guards double submit while the RPC is in flight

    const errs: { [key: string]: string } = {};
    const finalSlug = slug.trim().toLowerCase();

    if (!finalSlug || finalSlug.length < STORE_SLUG_MIN_LENGTH) {
      errs.slug = 'O link da loja deve ter pelo menos 3 caracteres alfanuméricos';
    } else if (finalSlug.length > STORE_SLUG_MAX_LENGTH) {
      errs.slug = 'O link da loja deve ter no máximo 63 caracteres';
    } else if (!STORE_SLUG_REGEX.test(finalSlug)) {
      errs.slug =
        'Use apenas letras minúsculas, números e hífen simples entre palavras (ex: minha-loja).';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setSubmitError(null);
      return;
    }

    if (!currentUser) {
      setErrors({});
      setSubmitError('Sua sessão expirou. Entre novamente para criar a loja.');
      return;
    }

    setErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const row = await createFirstStore({
        name: businessName,
        slug: finalSlug,
        category,
        addressStreet: street,
        addressNumber: number,
        addressCity: city,
        addressState: state,
        addressZipCode: zipCode,
        addressComplement: complement,
        addressNeighborhood: neighborhood,
        phone,
        whatsapp,
      });

      const store = buildStoreInstanceFromRow(row);
      SessionService.registerCreatedStore(store, currentUser.id);
      setCreatedStore(store);
      setStep(6); // Conclusão — só depois do banco confirmar
    } catch (error) {
      setSubmitError(toFriendlyStoreCreationError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 0: Primeiro Acesso Welcome Screen
  if (step === 0) {
    return (
      <div className="min-h-screen bg-[#07080A] text-zinc-100 flex flex-col justify-center items-center px-4 py-12 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="w-full max-w-lg text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
          {/* Logo badge */}
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#FF5500] to-[#E04400] flex items-center justify-center font-extrabold text-white text-3xl shadow-2xl shadow-orange-950/60 mx-auto">
            B
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Conta criada com sucesso!</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Vamos criar sua primeira loja
            </h1>
            <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
              Em menos de 2 minutos você configura seu endereço, formas de entrega e personaliza a identidade do seu restaurante.
            </p>
          </div>

          {/* Quick steps preview */}
          <div className="p-4 rounded-2xl bg-[#0D0F14] border border-zinc-800 text-left text-xs space-y-2.5">
            <span className="font-bold text-zinc-300 uppercase tracking-wider text-[11px] block mb-1">
              O que você vai configurar:
            </span>
            <div className="grid grid-cols-2 gap-2 text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <span>Dados do Negócio</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <span>Endereço de Atendimento</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <span>Taxas & Horários</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <span>Link da Loja Online</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {onCancel && (
              <Button variant="secondary" size="lg" onClick={onCancel} className="w-full sm:w-auto">
                Voltar
              </Button>
            )}
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                if (!slug) setSlug(generateSlug(businessName || 'minha-loja'));
                setStep(1);
              }}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full sm:w-auto font-bold px-8 shadow-xl shadow-orange-950/40"
            >
              Criar minha loja
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const stepsMeta = [
    { num: 1, label: 'Negócio', icon: Store },
    { num: 2, label: 'Endereço', icon: MapPin },
    { num: 3, label: 'Operação', icon: Bike },
    { num: 4, label: 'Identidade', icon: Palette },
    { num: 5, label: 'Loja Online', icon: Globe },
    { num: 6, label: 'Conclusão', icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen bg-[#07080A] text-zinc-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Header & Stepper */}
      <header className="border-b border-zinc-850 bg-[#0B0D12] sticky top-0 z-30 px-4 sm:px-8 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FF5500] to-[#E04400] flex items-center justify-center font-extrabold text-white text-base shadow-md shadow-orange-950/40">
              B
            </div>
            <span className="font-extrabold text-base tracking-tight text-white hidden sm:inline">
              BITEO
            </span>
          </div>

          {/* Stepper Dots & Labels */}
          <div className="flex items-center gap-1.5 sm:gap-3 overflow-x-auto no-scrollbar py-1">
            {stepsMeta.map(s => {
              const isActive = step === s.num;
              const isPast = step > s.num;

              return (
                <div key={s.num} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-950/40 ring-2 ring-orange-500/30'
                        : isPast
                        ? 'bg-emerald-500 text-white'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {isPast ? <Check className="w-3.5 h-3.5" /> : s.num}
                  </div>
                  <span
                    className={`text-xs font-semibold hidden md:inline ${
                      isActive ? 'text-white' : isPast ? 'text-zinc-300' : 'text-zinc-500'
                    }`}
                  >
                    {s.label}
                  </span>
                  {s.num < 6 && <span className="text-zinc-700 text-xs hidden sm:inline">→</span>}
                </div>
              );
            })}
          </div>

          {/* Step Indicator */}
          <span className="text-xs text-zinc-400 font-mono shrink-0">
            Etapa {step} de 6
          </span>
        </div>
      </header>

      {/* Main Wizard Form Body */}
      <main className="flex-1 flex justify-center items-start px-4 sm:px-6 py-8">
        <div className="w-full max-w-xl space-y-6">
          {/* ================= STEP 1: NEGÓCIO ================= */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-white">Sobre o seu Negócio</h2>
                <p className="text-xs text-zinc-400">
                  Como os clientes conhecem seu estabelecimento?
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-[#0D0F14] border border-zinc-800 space-y-4">
                {/* Nome */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Nome do Estabelecimento *
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={e => handleBusinessNameChange(e.target.value)}
                    placeholder="Ex: Restaurante da esquina"
                    className="w-full h-11 px-3.5 bg-[#07080A] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
                    autoFocus
                  />
                  {errors.name && <p className="text-xs text-rose-400">{errors.name}</p>}
                </div>

                {/* Categoria */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Segmento Principal *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                          category === cat
                            ? 'bg-orange-500/15 border-orange-500 text-orange-300'
                            : 'bg-[#07080A] border-zinc-850 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  {errors.category && (
                    <p className="text-xs text-rose-400">{errors.category}</p>
                  )}
                </div>

                {/* WhatsApp & Telefone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-zinc-300">
                      WhatsApp Comercial *
                    </label>
                    <input
                      type="tel"
                      value={whatsapp}
                      onChange={e => setWhatsapp(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full h-11 px-3.5 bg-[#07080A] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 font-mono"
                    />
                    {errors.whatsapp && <p className="text-xs text-rose-400">{errors.whatsapp}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-zinc-300">
                      Telefone Fixo (opcional)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="(11) 3222-1111"
                      className="w-full h-11 px-3.5 bg-[#07080A] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 font-mono"
                    />
                    {errors.phone && <p className="text-xs text-rose-400">{errors.phone}</p>}
                  </div>
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button variant="secondary" size="md" onClick={() => setStep(0)}>
                  Voltar
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    if (validateStep1()) setStep(2);
                  }}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Continuar para Endereço
                </Button>
              </div>
            </div>
          )}

          {/* ================= STEP 2: ENDEREÇO ================= */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-white">Endereço da Loja</h2>
                <p className="text-xs text-zinc-400">
                  Onde os clientes podem retirar e de onde saem as entregas?
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-[#0D0F14] border border-zinc-800 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-1">
                    <label className="block text-xs font-semibold text-zinc-300">CEP *</label>
                    <input
                      type="text"
                      value={zipCode}
                      onChange={e => setZipCode(e.target.value)}
                      placeholder="00000-000"
                      className="w-full h-11 px-3.5 bg-[#07080A] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 font-mono"
                    />
                    {errors.zipCode && <p className="text-xs text-rose-400">{errors.zipCode}</p>}
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="block text-xs font-semibold text-zinc-300">
                      Rua / Avenida *
                    </label>
                    <input
                      type="text"
                      value={street}
                      onChange={e => setStreet(e.target.value)}
                      placeholder="Ex: Av. Paulista"
                      className="w-full h-11 px-3.5 bg-[#07080A] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
                    />
                    {errors.street && <p className="text-xs text-rose-400">{errors.street}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-zinc-300">Número *</label>
                    <input
                      type="text"
                      value={number}
                      onChange={e => setNumber(e.target.value)}
                      placeholder="123"
                      className="w-full h-11 px-3.5 bg-[#07080A] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
                    />
                    {errors.number && <p className="text-xs text-rose-400">{errors.number}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-zinc-300">
                      Complemento (opcional)
                    </label>
                    <input
                      type="text"
                      value={complement}
                      onChange={e => setComplement(e.target.value)}
                      placeholder="Loja 2 / Sala 101"
                      className="w-full h-11 px-3.5 bg-[#07080A] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-1">
                    <label className="block text-xs font-semibold text-zinc-300">Bairro *</label>
                    <input
                      type="text"
                      value={neighborhood}
                      onChange={e => setNeighborhood(e.target.value)}
                      placeholder="Centro"
                      className="w-full h-11 px-3.5 bg-[#07080A] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
                    />
                    {errors.neighborhood && (
                      <p className="text-xs text-rose-400">{errors.neighborhood}</p>
                    )}
                  </div>

                  <div className="space-y-1 sm:col-span-1">
                    <label className="block text-xs font-semibold text-zinc-300">Cidade *</label>
                    <input
                      type="text"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder="São Paulo"
                      className="w-full h-11 px-3.5 bg-[#07080A] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
                    />
                    {errors.city && <p className="text-xs text-rose-400">{errors.city}</p>}
                  </div>

                  <div className="space-y-1 sm:col-span-1">
                    <label className="block text-xs font-semibold text-zinc-300">Estado *</label>
                    <input
                      type="text"
                      value={state}
                      onChange={e => setState(e.target.value.toUpperCase())}
                      placeholder="SP"
                      maxLength={2}
                      className="w-full h-11 px-3.5 bg-[#07080A] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 text-center font-mono"
                    />
                    {errors.state && <p className="text-xs text-rose-400">{errors.state}</p>}
                  </div>
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button variant="secondary" size="md" onClick={() => setStep(1)}>
                  Voltar
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    if (validateStep2()) setStep(3);
                  }}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Continuar para Operação
                </Button>
              </div>
            </div>
          )}

          {/* ================= STEP 3: OPERAÇÃO ================= */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-white">Operação & Entregas</h2>
                <p className="text-xs text-zinc-400">
                  Como seus clientes poderão receber os pedidos?
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-[#0D0F14] border border-zinc-800 space-y-4">
                {/* Modalities Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Modalidades de Atendimento *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        allowDelivery
                          ? 'bg-orange-500/10 border-orange-500/60 text-white'
                          : 'bg-[#07080A] border-zinc-850 text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={allowDelivery}
                          onChange={e => setAllowDelivery(e.target.checked)}
                          className="w-4 h-4 rounded text-orange-500 focus:ring-0 bg-zinc-900 border-zinc-700"
                        />
                        <div>
                          <p className="font-bold text-xs">Delivery</p>
                          <p className="text-[11px] text-zinc-400">Entrega no endereço do cliente</p>
                        </div>
                      </div>
                      <Bike className="w-4 h-4 text-orange-400" />
                    </label>

                    <label
                      className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        allowPickup
                          ? 'bg-orange-500/10 border-orange-500/60 text-white'
                          : 'bg-[#07080A] border-zinc-850 text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={allowPickup}
                          onChange={e => setAllowPickup(e.target.checked)}
                          className="w-4 h-4 rounded text-orange-500 focus:ring-0 bg-zinc-900 border-zinc-700"
                        />
                        <div>
                          <p className="font-bold text-xs">Retirada</p>
                          <p className="text-[11px] text-zinc-400">Cliente retira no balcão</p>
                        </div>
                      </div>
                      <Store className="w-4 h-4 text-sky-400" />
                    </label>
                  </div>
                  {errors.operation && <p className="text-xs text-rose-400">{errors.operation}</p>}
                </div>

                {/* Delivery specifics if enabled */}
                {allowDelivery && (
                  <div className="pt-3 border-t border-zinc-850/80 space-y-3 animate-in fade-in">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wider block">
                      Configurações do Delivery
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-zinc-300">
                          Taxa Padrão (R$)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={fixedFee}
                          onChange={e => setFixedFee(parseFloat(e.target.value) || 0)}
                          className="w-full h-11 px-3.5 bg-[#07080A] border border-zinc-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-zinc-300">
                          Pedido Mínimo (R$)
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={minimumOrderValue}
                          onChange={e => setMinimumOrderValue(parseFloat(e.target.value) || 0)}
                          className="w-full h-11 px-3.5 bg-[#07080A] border border-zinc-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-zinc-300">
                          Tempo Estimado
                        </label>
                        <input
                          type="text"
                          value={estimatedDeliveryTime}
                          onChange={e => setEstimatedDeliveryTime(e.target.value)}
                          placeholder="35 a 50 min"
                          className="w-full h-11 px-3.5 bg-[#07080A] border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Pickup specifics */}
                {allowPickup && (
                  <div className="pt-3 border-t border-zinc-850/80 space-y-2">
                    <span className="text-xs font-bold text-sky-400 uppercase tracking-wider block">
                      Tempo para Retirada no Balcão
                    </span>
                    <input
                      type="text"
                      value={estimatedPickupTime}
                      onChange={e => setEstimatedPickupTime(e.target.value)}
                      placeholder="15 a 25 min"
                      className="w-full sm:w-1/2 h-11 px-3.5 bg-[#07080A] border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                )}
              </div>

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button variant="secondary" size="md" onClick={() => setStep(2)}>
                  Voltar
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    if (validateStep3()) setStep(4);
                  }}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Continuar para Identidade
                </Button>
              </div>
            </div>
          )}

          {/* ================= STEP 4: IDENTIDADE ================= */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-white">Identidade Visual</h2>
                <p className="text-xs text-zinc-400">
                  Personalize a cor principal e o estilo visual da sua loja.
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-[#0D0F14] border border-zinc-800 space-y-5">
                {/* Primary Color Palette */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Cor Principal da Marca
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setPrimaryColor(c.hex)}
                        className={`h-11 rounded-xl flex items-center justify-center font-bold text-xs transition-transform active:scale-95 ${
                          primaryColor === c.hex ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-105' : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      >
                        {primaryColor === c.hex && <Check className="w-4 h-4 text-white drop-shadow" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visual Style */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Estilo Visual do Cardápio
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {(['moderno', 'minimalista', 'vibrante'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setVisualStyle(s)}
                        className={`p-3 rounded-2xl border font-semibold capitalize text-center transition-all ${
                          visualStyle === s
                            ? 'bg-orange-500/15 border-orange-500 text-orange-300 shadow-sm'
                            : 'bg-[#07080A] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Store Live Mini Preview Card */}
                <div className="pt-3 border-t border-zinc-850/80 space-y-2">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Prévia ao vivo da Loja
                  </span>
                  <div className="p-4 rounded-2xl bg-[#141722] border border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-extrabold text-xl shadow-lg"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {businessName.charAt(0) || 'B'}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{businessName || 'Nome do Restaurante'}</h4>
                        <p className="text-xs text-zinc-400">{category}</p>
                      </div>
                    </div>
                    <span
                      className="px-3 py-1 rounded-xl text-xs font-bold text-white shadow-md"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Ver Cardápio
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button variant="secondary" size="md" onClick={() => setStep(3)}>
                  Voltar
                </Button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(5)}
                    className="text-xs text-zinc-400 hover:text-zinc-200 underline px-2"
                  >
                    Configurar depois
                  </button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setStep(5)}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Continuar para Link
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 5: LOJA ONLINE ================= */}
          {step === 5 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-white">Link da Loja Online</h2>
                <p className="text-xs text-zinc-400">
                  Defina o endereço exclusivo para seus clientes acessarem pelo navegador.
                </p>
              </div>

              <div className="p-5 rounded-3xl bg-[#0D0F14] border border-zinc-800 space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-zinc-300">
                    URL Exclusiva *
                  </label>
                  <div className="flex items-center rounded-xl bg-[#07080A] border border-zinc-800 px-3.5 focus-within:border-orange-500 transition-colors">
                    <span className="text-xs text-zinc-500 font-mono select-none">
                      biteo.com.br/
                    </span>
                    <input
                      type="text"
                      value={slug}
                      onChange={e => {
                        setIsSlugCustomized(true);
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                        if (errors.slug) setErrors({});
                        if (submitError) setSubmitError(null);
                      }}
                      placeholder="minha-loja"
                      className="w-full h-11 bg-transparent text-sm text-white font-mono focus:outline-none pl-1"
                    />
                  </div>

                  {/* Slug format indicator. Availability is enforced by the
                      database (unique index); it is never claimed here. */}
                  {slug.trim().length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1 text-xs">
                      {STORE_SLUG_REGEX.test(slug.trim().toLowerCase()) ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <Check className="w-3.5 h-3.5" />
                          <span>Formato válido: biteo.com.br/{slug.trim().toLowerCase()}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                          <X className="w-3.5 h-3.5" />
                          <span>Use apenas letras minúsculas, números e hífen simples (ex: minha-loja).</span>
                        </div>
                      )}
                    </div>
                  )}

                  {errors.slug && <p className="text-xs text-rose-400 font-medium">{errors.slug}</p>}
                </div>

                <div className="p-3.5 rounded-2xl bg-[#13161D] border border-zinc-850 text-xs text-zinc-400 space-y-1 leading-relaxed">
                  <p className="font-semibold text-zinc-300">
                    💡 Dica para divulgação:
                  </p>
                  <p>
                    Esse link será adicionado na bio do seu Instagram e poderá ser compartilhado por mensagem automática com seus clientes.
                  </p>
                </div>
              </div>

              {/* Real registration failure surfaced in place */}
              {submitError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
                  <X className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setStep(4)}
                  disabled={isSubmitting}
                >
                  Voltar
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleCreateStore}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="font-bold"
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                >
                  Concluir e Criar Loja
                </Button>
              </div>
            </div>
          )}

          {/* ================= STEP 6: CONCLUSÃO ================= */}
          {step === 6 && createdStore && (
            <div className="space-y-6 text-center animate-in fade-in zoom-in-95 duration-300 py-4">
              {/* Celebration icon */}
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-2xl animate-bounce">
                <Sparkles className="w-10 h-10" />
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Estabelecimento Ativo</span>
                </div>
                <h1 className="text-3xl font-extrabold text-white">
                  Sua loja está pronta! 🎉
                </h1>
                <p className="text-xs sm:text-sm text-zinc-300 max-w-sm mx-auto leading-relaxed">
                  Agora você pode montar seu cardápio e começar a receber pedidos diretamente no seu painel.
                </p>
              </div>

              {/* Store Identity Summary Card */}
              <div className="p-5 rounded-3xl bg-[#0E1015] border border-zinc-800 text-left space-y-4 max-w-md mx-auto shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-850">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-extrabold text-xl shadow-lg"
                      style={{ backgroundColor: createdStore.config.theme.primaryColor }}
                    >
                      {createdStore.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base">{createdStore.name}</h4>
                      <p className="text-xs text-zinc-400">{createdStore.category}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                    Aberta
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Link Oficial:</span>
                    <span className="font-mono text-orange-400 font-semibold">
                      biteo.com.br/{createdStore.slug}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Atendimento:</span>
                    <span className="text-zinc-200">
                      {createdStore.config.delivery.allowDelivery && 'Delivery'}
                      {createdStore.config.delivery.allowDelivery && createdStore.config.delivery.allowPickup && ' · '}
                      {createdStore.config.delivery.allowPickup && 'Retirada'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span>Endereço:</span>
                    <span className="text-zinc-200 truncate max-w-[200px]">
                      {createdStore.config.info.address}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-md mx-auto">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={() => onComplete(createdStore, 'merchant')}
                  leftIcon={<Store className="w-4 h-4" />}
                  className="font-bold shadow-xl shadow-orange-950/40"
                >
                  Entrar no meu painel
                </Button>

                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={() => onComplete(createdStore, 'storefront')}
                  leftIcon={<Eye className="w-4 h-4" />}
                >
                  Visualizar minha loja
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
