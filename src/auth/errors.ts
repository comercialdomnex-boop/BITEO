/**
 * Turns Supabase Auth / GoTrue / PostgREST failures into messages a Brazilian
 * merchant can actually act on. Everything the user sees goes through here, so
 * raw English error text never reaches the interface.
 */

interface ErrorLike {
  code?: string;
  status?: number;
  message?: string;
}

function asErrorLike(error: unknown): ErrorLike {
  if (error && typeof error === 'object') return error as ErrorLike;
  if (typeof error === 'string') return { message: error };
  return {};
}

function normalize(error: unknown): string {
  const like = asErrorLike(error);
  return `${like.code ?? ''} ${like.message ?? ''}`.toLowerCase();
}

const RULES: Array<{ match: (text: string, error: ErrorLike) => boolean; message: string }> = [
  {
    match: text => text.includes('invalid login credentials') || text.includes('invalid_credentials'),
    message: 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
  },
  {
    match: text => text.includes('email not confirmed'),
    message:
      'Confirme seu e-mail antes de entrar. Abra a mensagem de confirmação que enviamos para a sua caixa de entrada (confira também o spam).',
  },
  {
    match: text => text.includes('user already registered') || text.includes('user_already_exists') || text.includes('already been registered'),
    message: 'Já existe uma conta com este e-mail. Entre ou recupere a senha.',
  },
  {
    match: text =>
      text.includes('password should be at least') ||
      text.includes('password is too short') ||
      text.includes('weak_password') ||
      text.includes('signup requires a valid password'),
    message: 'A senha deve ter pelo menos 6 caracteres.',
  },
  {
    match: text => text.includes('rate limit') || text.includes('rate_limit') || text.includes('too many requests') || text.includes('security purposes'),
    message:
      'Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.',
  },
  {
    match: text => text.includes('email rate limit') || text.includes('email rate_limit'),
    message:
      'Já enviamos um link recentemente para este e-mail. Aguarde alguns minutos antes de solicitar outro.',
  },
  {
    match: text => text.includes('token has expired') || text.includes('invalid token') || text.includes('otp_expired') || text.includes('refresh_token_not_found'),
    message: 'O link expirou ou já foi usado. Solicite um novo link de recuperação.',
  },
  {
    match: text => text.includes('same password') || text.includes('new password should be different'),
    message: 'A nova senha deve ser diferente da senha atual.',
  },
  {
    match: text => text.includes('user not found') || text.includes('user_not_found'),
    message: 'Não encontramos uma conta com este e-mail.',
  },
  {
    match: text => text.includes('provider') && text.includes('not'),
    message: 'Método de acesso indisponível para esta conta.',
  },
  {
    match: text => text.includes('failed to fetch') || text.includes('networkerror') || text.includes('load failed'),
    message: 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.',
  },
  {
    match: (text, error) => error.status === 403 && text.includes('row-level security'),
    message:
      'O servidor recusou a operação por permissão de segurança (RLS). Verifique a configuração do Supabase.',
  },
];

/** Friendly, actionable pt-BR message for any auth/network failure. */
export function toFriendlyAuthError(error: unknown): string {
  const text = normalize(error);
  const like = asErrorLike(error);

  for (const rule of RULES) {
    if (rule.match(text, like)) return rule.message;
  }

  return 'Não foi possível concluir a operação. Tente novamente em instantes.';
}

/**
 * public.create_first_store raises real Postgres errors (23505, 42501, 22023,
 * P0002). Each one becomes an actionable pt-BR message: slug taken, already has a
 * store, missing session/profile, or invalid data. No generic fallback hides
 * them.
 */
const STORE_CREATION_RULES: Array<{ match: (text: string, error: ErrorLike) => boolean; message: string }> = [
  {
    match: text => text.includes('already in use') || text.includes('23505') || text.includes('duplicate key'),
    message:
      'Este link já está em uso. Escolha outro endereço para a sua loja.',
  },
  {
    match: text => text.includes('already has an active store membership'),
    message: 'Sua conta já possui uma loja cadastrada. Cada usuário pode criar a primeira loja apenas uma vez.',
  },
  {
    match: text => text.includes('authentication is required'),
    message: 'Sua sessão expirou. Entre novamente para criar a loja.',
  },
  {
    match: text => text.includes('profile for the authenticated user does not exist') || text.includes('p0002'),
    message:
      'Não encontramos seu perfil de usuário no servidor. Saia e entre novamente; se persistir, contate o suporte.',
  },
  {
    match: text => text.includes('store name') || text.includes('store slug') || text.includes('store category'),
    message: 'Dados da loja inválidos. Revise nome, link e segmento e tente novamente.',
  },
  {
    match: text => text.includes('address'),
    message: 'Endereço inválido. Revise os campos de endereço e tente novamente.',
  },
  {
    match: text => text.includes('e.164') || text.includes('phone') || text.includes('whatsapp'),
    message: 'Telefone ou WhatsApp em formato inválido. Informe um número com DDD.',
  },
  {
    match: text => text.includes('22023'),
    message: 'Alguns dados enviados são inválidos. Revise o formulário e tente novamente.',
  },
  {
    match: (text, error) => error.status === 42501 || text.includes('permission denied') || text.includes('42501'),
    message: 'Sem permissão para criar a loja. Verifique se você está autenticado e tente novamente.',
  },
];

/** Friendly, actionable pt-BR message for a create_first_store failure. */
export function toFriendlyStoreCreationError(error: unknown): string {
  const text = normalize(error);
  const like = asErrorLike(error);

  for (const rule of STORE_CREATION_RULES) {
    if (rule.match(text, like)) return rule.message;
  }

  return toFriendlyAuthError(error);
}

/** Profile reads fail loudly (usually grants/RLS on public.profiles) but must stay readable. */
export function toFriendlyProfileError(error: unknown): string {
  const text = normalize(error);
  const like = asErrorLike(error);

  if (like.status === 42501 || text.includes('permission denied')) {
    return 'Sem permissão para ler o perfil (grants/RLS de public.profiles pendentes no Supabase).';
  }
  if (text.includes('failed to fetch') || text.includes('networkerror')) {
    return 'Não foi possível carregar o perfil: sem conexão com o Supabase.';
  }
  return toFriendlyAuthError(error);
}

/**
 * public.stores / public.store_settings updates hit real Postgres constraints
 * (23514 checks, 23505 unique, 42501 RLS). Each becomes an actionable pt-BR
 * message; the generic network/fallback path is reused last.
 */
const STORE_UPDATE_RULES: Array<{ match: (text: string, error: ErrorLike) => boolean; message: string }> = [
  {
    match: (text, error) => error.status === 42501 || text.includes('permission denied'),
    message: 'Sem permissão para salvar estas informações nesta loja.',
  },
  {
    match: text => text.includes('row-level security') || text.includes('rls'),
    message: 'O servidor recusou a gravação por segurança (RLS). Verifique seu papel na loja.',
  },
  {
    match: text => text.includes('stores_name_not_blank'),
    message: 'O nome da loja não pode ficar vazio.',
  },
  {
    match: text => text.includes('stores_category_not_blank'),
    message: 'O segmento/categoria não pode ficar vazio.',
  },
  {
    match: text => text.includes('address_city_not_blank'),
    message: 'A cidade não pode ficar vazia.',
  },
  {
    match: text => text.includes('address_state_not_blank'),
    message: 'O estado (UF) não pode ficar vazio.',
  },
  {
    match: text => text.includes('phone_e164') || text.includes('whatsapp_e164'),
    message: 'Telefone ou WhatsApp em formato inválido. Informe um número com DDD.',
  },
  {
    match: text => text.includes('slug') && (text.includes('23505') || text.includes('unique') || text.includes('duplicate')),
    message: 'Este link já está em uso. Escolha outro endereço para a sua loja.',
  },
  {
    match: text => text.includes('prep_time_positive'),
    message: 'O tempo de preparo deve ser maior que zero.',
  },
  {
    match: text => text.includes('delivery_window_check') || text.includes('delivery_minutes_positive'),
    message: 'Os tempos de entrega são inválidos. Revise os minutos informados.',
  },
  {
    match: text => text.includes('23514') || text.includes('check constraint') || text.includes('violates check'),
    message: 'Algum campo está inválido. Revise as informações e tente novamente.',
  },
];

/** Friendly, actionable pt-BR message for a store profile update failure. */
export function toFriendlyStoreUpdateError(error: unknown): string {
  const text = normalize(error);
  const like = asErrorLike(error);

  for (const rule of STORE_UPDATE_RULES) {
    if (rule.match(text, like)) return rule.message;
  }

  return toFriendlyAuthError(error);
}
