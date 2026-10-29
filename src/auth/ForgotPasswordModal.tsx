import React, { useState } from 'react';
import { Modal, Button } from '../components/shared';
import { Mail, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from './AuthProvider';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
}) => {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [isSent, setIsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!email.trim() || !email.includes('@')) {
      setError('Por favor, informe um e-mail válido.');
      return;
    }

    setError(null);
    setIsLoading(true);
    // Real recovery e-mail from Supabase Auth. The link returns to this origin,
    // where the recovery session opens the password reset screen.
    const { error: resetError } = await sendPasswordReset(email);
    setIsLoading(false);

    if (resetError) {
      setError(resetError);
      return;
    }
    setIsSent(true);
  };

  const handleReset = () => {
    setIsSent(false);
    setEmail('');
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleReset}
      title={isSent ? 'Recuperação Enviada' : 'Recuperar senha'}
      subtitle={
        isSent
          ? 'Instruções enviadas para o seu endereço de e-mail'
          : 'Digite seu e-mail cadastrado para redefinir sua senha'
      }
      maxWidth="sm"
    >
      {isSent ? (
        <div className="text-center py-4 space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h4 className="text-base font-bold text-white">
              Link de recuperação enviado
            </h4>
            <p className="text-xs text-zinc-300 max-w-xs mx-auto leading-relaxed">
              Se existir uma conta com{' '}
              <strong className="text-orange-400">{email}</strong>, você receberá
              um e-mail com o link para definir uma nova senha. Confira também a
              caixa de spam. O link expira em alguns minutos.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={handleReset}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Voltar para o login
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="recovery-email" className="block text-xs font-semibold text-zinc-300">
              E-mail cadastrado *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="recovery-email"
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="seu.email@exemplo.com"
                className="w-full h-11 pl-10 pr-3.5 bg-[#0A0C10] border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500 transition-colors"
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="md" type="button" onClick={handleReset}>
              Cancelar
            </Button>
            <Button variant="primary" size="md" type="submit" isLoading={isLoading}>
              Enviar link de recuperação
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
