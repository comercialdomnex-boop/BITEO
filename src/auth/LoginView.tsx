import React, { useState } from 'react';
import { Button } from '../components/shared';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { useAuth } from './AuthProvider';
import { BiteoParticles } from '../components/BiteoParticles';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Store,
  TrendingUp,
  ShieldCheck,
  QrCode,
  Smartphone,
  Layers,
} from 'lucide-react';

interface LoginViewProps {
  onGoToRegister: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onGoToRegister }) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!email.trim() || !email.includes('@')) {
      setError('Por favor, informe um e-mail válido.');
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    // Real session: on success the auth listener flips the app to the
    // authenticated state and this view is replaced automatically.
    const { error: signInError } = await signIn(email, password, {
      remember: rememberMe,
    });
    setIsSubmitting(false);
    if (signInError) setError(signInError);
  };

  return (
    <div className="min-h-screen bg-[#07080A] text-zinc-100 flex flex-col md:flex-row font-['Plus_Jakarta_Sans',sans-serif]">
      {/* LEFT COLUMN: Premium SaaS Branding (Visible on Tablet/Desktop) */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-10 xl:p-14 bg-gradient-to-br from-[#0B0D13] via-[#0F1219] to-[#151924] border-r border-zinc-850 relative isolate overflow-hidden">
        {/* Animated BITEO particles */}
        <BiteoParticles />

        {/* Glow ambient light */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

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
              <p className="text-xs text-zinc-400 font-medium tracking-wide">
                Smart orders. Better business.
              </p>
            </div>
          </div>
        </div>

        {/* Middle Hero Showcase */}
        <div className="relative z-10 max-w-lg space-y-6 my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-400 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Plataforma SaaS para Restaurantes & Delivery</span>
          </div>

          <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight">
            Venda direto ao cliente com sua própria loja online profissional.
          </h2>

          <p className="text-sm text-zinc-300 leading-relaxed">
            Elimine intermediários e taxas abusivas. Tenha cardápio interativo com QR code, controle de pedidos em tempo real na cozinha e base própria de clientes fiéis.
          </p>

          {/* Value Propositions */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-1">
              <div className="flex items-center gap-2 text-orange-400 font-bold text-xs">
                <Smartphone className="w-4 h-4" />
                <span>Cardápio Digital</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Página própria rápida para pedidos via WhatsApp e delivery.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <TrendingUp className="w-4 h-4" />
                <span>Gestão Completa</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Histórico de clientes, faturamento e relatórios automáticos.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Social Proof */}
        <div className="relative z-10 pt-4 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Ambiente seguro Biteo Platform</span>
          </div>
          <span className="font-mono text-[11px] text-zinc-500">v2.5 Multi-Store Ready</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Authentication Form */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 sm:px-8 py-10 max-w-xl mx-auto w-full">
        {/* Mobile Header Logo (visible only on mobile) */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#FF5500] to-[#E04400] flex items-center justify-center font-extrabold text-white text-lg shadow-lg shadow-orange-950/40">
            B
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg text-white">BITEO</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500]" />
            </div>
            <p className="text-[10px] text-zinc-400">Plataforma SaaS para Restaurantes</p>
          </div>
        </div>

        <div className="w-full max-w-md space-y-6">
          {/* Card Header */}
          <div className="space-y-1.5 text-left">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Bem-vindo de volta
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              Entre para gerenciar seu negócio e seus pedidos.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200"
              >
                {error}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold text-zinc-300">
                E-mail *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="seu.email@restaurante.com"
                  className="w-full h-11 pl-10 pr-3.5 bg-[#0D0F14] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-semibold text-zinc-300">
                  Senha *
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-xs text-orange-400 hover:text-orange-300 font-medium transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-10 bg-[#0D0F14] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-orange-500 focus:ring-0 focus:ring-offset-0"
                />
                <span className="text-xs text-zinc-400">Lembrar de mim</span>
              </label>
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
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          {/* Footer Call to Action */}
          <div className="text-center pt-3 border-t border-zinc-850 text-xs text-zinc-400">
            <span>Ainda não tem uma conta? </span>
            <button
              type="button"
              onClick={onGoToRegister}
              className="text-orange-400 hover:text-orange-300 font-bold underline transition-colors"
            >
              Criar minha conta
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        initialEmail={email}
      />
    </div>
  );
};
