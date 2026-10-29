import React, { useState } from 'react';
import { Button } from '../components/shared';
import { useAuth } from './AuthProvider';
import { Lock, Eye, EyeOff, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';

interface ResetPasswordViewProps {
  /** Called after the new password is stored and the recovery flag is cleared. */
  onSuccess: () => void;
  /** Called when the user gives up and returns to the login screen. */
  onCancel: () => void;
}

/**
 * Landing screen for password-recovery links: the URL hash carries a real
 * recovery session, so updateUser({ password }) is allowed here. Same visual
 * language as the other access screens.
 */
export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setIsSubmitting(false);

    if (updateError) {
      setError(updateError);
      return;
    }
    setIsDone(true);
  };

  if (isDone) {
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
                Senha redefinida
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Sua nova senha já está ativa. Use-a na próxima vez que entrar na
                plataforma.
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onSuccess}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Ir para o painel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080A] text-zinc-100 flex flex-col items-center justify-center px-4 py-10 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="flex items-center justify-center gap-3">
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

        <div className="p-6 rounded-3xl bg-[#13161D] border border-zinc-800 space-y-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-400 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Recuperação de senha</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Defina uma nova senha
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              Escolha uma senha diferente da anterior para proteger sua conta.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200"
              >
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="new-password"
                className="block text-xs font-semibold text-zinc-300"
              >
                Nova senha *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoFocus
                  className="w-full h-11 pl-10 pr-10 bg-[#0D0F14] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirm-new-password"
                className="block text-xs font-semibold text-zinc-300"
              >
                Confirmar nova senha *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="confirm-new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full h-11 pl-10 pr-3.5 bg-[#0D0F14] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              type="submit"
              isLoading={isSubmitting}
              className="mt-1 font-bold"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
          </form>

          <div className="text-center pt-3 border-t border-zinc-800 text-xs text-zinc-400">
            <button
              type="button"
              onClick={onCancel}
              className="text-orange-400 hover:text-orange-300 font-bold underline transition-colors"
            >
              Voltar para o login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
