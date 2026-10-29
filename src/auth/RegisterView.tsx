import React, { useState } from 'react';
import { Button } from '../components/shared';
import { digitsOnly, normalizePhone } from '../utils/phone';
import { useAuth } from './AuthProvider';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Store,
} from 'lucide-react';

interface RegisterViewProps {
  onGoToLogin: () => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({ onGoToLogin }) => {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Account created, waiting for the confirmation e-mail: a real state, not a mock.
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  const formatPhone = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 11);
    if (raw.length <= 2) return raw;
    if (raw.length <= 6) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    if (raw.length <= 10)
      return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
    return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
  };

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim() || name.trim().length < 3) {
      newErrors.name = 'Informe seu nome completo (mínimo 3 caracteres)';
    }

    const cleanPhone = digitsOnly(whatsapp);
    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      newErrors.whatsapp = 'Informe um WhatsApp com DDD válido (ex: 11 98888-7777)';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      newErrors.email = 'Informe um e-mail válido';
    }

    if (!password || password.length < 6) {
      newErrors.password = 'A senha deve conter pelo menos 6 caracteres';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'As senhas não coincidem';
    }

    if (!acceptedTerms) {
      newErrors.terms = 'Você precisa aceitar os termos de uso para continuar';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setApiError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    // Real account: Supabase Auth creates auth.users and the
    // private.handle_new_user() trigger writes public.profiles. No store and no
    // membership are created here.
    const { error, needsEmailConfirmation: confirmationPending } = await signUp({
      name: name.trim(),
      phone: normalizePhone(whatsapp),
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);

    if (error) {
      setApiError(error);
      return;
    }
    if (confirmationPending) {
      setNeedsEmailConfirmation(true);
    }
    // Otherwise the session already exists: the auth listener routes the app.
  };

  if (needsEmailConfirmation) {
    return (
      <div className="min-h-screen bg-[#07080A] text-zinc-100 flex flex-col items-center justify-center px-4 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF5500] to-[#E04400] flex items-center justify-center font-extrabold text-white text-xl shadow-xl shadow-orange-950/60">
              B
            </div>
            <span className="font-extrabold text-xl tracking-tight text-white">
              BITEO
            </span>
            <span className="w-2 h-2 rounded-full bg-[#FF5500]" />
          </div>

          <div className="p-6 rounded-3xl bg-[#13161D] border border-zinc-800 space-y-4 text-left">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                Confirme seu e-mail
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Enviamos um link de confirmação para{' '}
                <strong className="text-orange-400">{email.trim()}</strong>. Abra
                o link para ativar a conta e depois entre normalmente. Se a
                mensagem não aparecer, confira a caixa de spam.
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onGoToLogin}
              leftIcon={<ArrowRight className="w-4 h-4" />}
            >
              Ir para o login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080A] text-zinc-100 flex flex-col md:flex-row font-['Plus_Jakarta_Sans',sans-serif]">
      {/* LEFT COLUMN: Branding & Perks */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-10 xl:p-14 bg-gradient-to-br from-[#0B0D13] via-[#0F1219] to-[#151924] border-r border-zinc-850 relative overflow-hidden">
        {/* Glow ambient light */}
        <div className="absolute top-1/3 -left-20 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF5500] to-[#E04400] flex items-center justify-center font-extrabold text-white text-xl shadow-xl shadow-orange-950/60">
              B
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xl tracking-tight text-white">
                  BITEO
                </span>
                <span className="w-2 h-2 rounded-full bg-[#FF5500]" />
              </div>
              <p className="text-xs text-zinc-400 font-medium">Smart orders. Better business.</p>
            </div>
          </div>
        </div>

        {/* Hero Benefits */}
        <div className="relative z-10 max-w-lg space-y-6 my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Comece a Vender em Minutos</span>
          </div>

          <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight">
            Crie sua conta no Biteo e transforme suas vendas online.
          </h2>

          <p className="text-sm text-zinc-300 leading-relaxed">
            Em poucos passos você configura seu primeiro estabelecimento, adiciona seus itens ao cardápio e recebe pedidos diretamente no seu WhatsApp e painel.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 text-xs text-zinc-300">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                ✓
              </div>
              <span>Sem comissão por pedido · 100% do faturamento é seu</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-300">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                ✓
              </div>
              <span>Cardápio digital responsivo com link exclusivo para bio do Instagram</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-300">
              <div className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                ✓
              </div>
              <span>Impressão de comandas na cozinha e emissão rápida</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 pt-4 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Dados protegidos · Plataforma Biteo</span>
          </div>
          <span className="font-mono text-[11px] text-zinc-500">SaaS Seguro</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Registration Form */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 sm:px-8 py-8 sm:py-12 max-w-xl mx-auto w-full">
        {/* Mobile Header Logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-[#FF5500] to-[#E04400] flex items-center justify-center font-extrabold text-white text-base shadow-md shadow-orange-950/40">
            B
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base text-white">BITEO</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500]" />
            </div>
            <p className="text-[10px] text-zinc-400">Crie sua conta profissional</p>
          </div>
        </div>

        <div className="w-full max-w-md space-y-5">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Crie sua conta no Biteo
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              Comece a vender online e gerencie seu negócio em um só lugar.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {apiError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200"
              >
                {apiError}
              </div>
            )}

            {/* Nome Completo */}
            <div className="space-y-1">
              <label htmlFor="name" className="block text-xs font-semibold text-zinc-300">
                Nome completo *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo Silva"
                  className="w-full h-11 pl-10 pr-3.5 bg-[#0D0F14] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              {errors.name && <p className="text-xs text-rose-400 font-medium">{errors.name}</p>}
            </div>

            {/* WhatsApp */}
            <div className="space-y-1">
              <label htmlFor="whatsapp" className="block text-xs font-semibold text-zinc-300">
                WhatsApp de contato *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="whatsapp"
                  type="tel"
                  value={whatsapp}
                  onChange={e => setWhatsapp(formatPhone(e.target.value))}
                  placeholder="(11) 98888-7777"
                  className="w-full h-11 pl-10 pr-3.5 bg-[#0D0F14] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              {errors.whatsapp && (
                <p className="text-xs text-rose-400 font-medium">{errors.whatsapp}</p>
              )}
            </div>

            {/* E-mail */}
            <div className="space-y-1">
              <label htmlFor="email" className="block text-xs font-semibold text-zinc-300">
                E-mail de acesso *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="w-full h-11 pl-10 pr-3.5 bg-[#0D0F14] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              {errors.email && <p className="text-xs text-rose-400 font-medium">{errors.email}</p>}
            </div>

            {/* Senha & Confirmar Senha */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="password" className="block text-xs font-semibold text-zinc-300">
                  Senha *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mín. 6 dígitos"
                    className="w-full h-11 pl-10 pr-9 bg-[#0D0F14] border border-zinc-800 rounded-xl text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-rose-400 font-medium">{errors.password}</p>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="confirmPassword" className="block text-xs font-semibold text-zinc-300">
                  Confirmar senha *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full h-11 pl-10 pr-3.5 bg-[#0D0F14] border border-zinc-800 rounded-xl text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-rose-400 font-medium">{errors.confirmPassword}</p>
                )}
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={e => setAcceptedTerms(e.target.checked)}
                  className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-orange-500 focus:ring-0 mt-0.5"
                />
                <span className="text-xs text-zinc-400 leading-relaxed">
                  Li e aceito os{' '}
                  <span className="text-zinc-200 underline font-semibold">
                    Termos de Uso
                  </span>{' '}
                  e a{' '}
                  <span className="text-zinc-200 underline font-semibold">
                    Política de Privacidade
                  </span>{' '}
                  da plataforma BITEO.
                </span>
              </label>
              {errors.terms && <p className="text-xs text-rose-400 font-medium mt-1">{errors.terms}</p>}
            </div>

            {/* Submit Button */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              type="submit"
              isLoading={isSubmitting}
              className="mt-2 font-bold"
            >
              {isSubmitting ? 'Criando conta...' : 'Criar conta'}
            </Button>
          </form>

          {/* Footer Call to Action */}
          <div className="text-center pt-2 border-t border-zinc-850 text-xs text-zinc-400">
            <span>Já tem uma conta? </span>
            <button
              type="button"
              onClick={onGoToLogin}
              className="text-orange-400 hover:text-orange-300 font-bold underline transition-colors"
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
