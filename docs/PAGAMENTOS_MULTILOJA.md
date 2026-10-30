# BITEO — Pagamentos PIX multi-loja (plano de implementação)

## Diagnóstico do código existente (30/10/2026)

- O checkout já identifica a loja pelo `storeId`, e `order_pix_payments` registra `store_id` e `order_id`.
- A migration de confirmação compara pedido, loja, valor e pagamento Asaas; eventos repetidos são idempotentes.
- **Bloqueador comercial:** `_shared/asaas-sandbox.ts` lê uma única `ASAAS_API_KEY` global. Assim, todas as cobranças são criadas na mesma conta Asaas, independentemente da loja. **Não lançar como recebimento independente por estabelecimento.**
- O código ainda aponta exclusivamente para `api-sandbox.asaas.com`.
- O frontend não deve receber credenciais do provedor.

## Arquitetura alvo

1. Cada loja possui uma configuração de recebimento, com vínculo inequívoco ao estabelecimento e ao provedor. A configuração é mantida apenas no backend, com políticas de acesso por loja e auditoria.
2. A estratégia de recebimento deve ser escolhida após validar as opções contratuais e operacionais do Asaas: **subcontas**, contas independentes ou split. Não assumir que subcontas/split estão habilitados nem que têm custos específicos.
3. No provisionamento, resolver a credencial de pagamento a partir da loja persistida no pedido — nunca de uma chave ou identificador fornecido pelo navegador.
4. Persistir um identificador de conta do provedor por cobrança, junto de `store_id`, `order_id`, ambiente, valor e ID da cobrança. **Não armazenar tokens em tabelas acessíveis ao cliente.**
5. Webhooks: autenticar o evento, resolver a conta/loja correta, consultar o pagamento usando a credencial dessa conta, conferir ID externo, valor, loja e ambiente, e confirmar uma única vez. Eventos desconhecidos não devem confirmar pedidos.
6. Falha/timeout de criação de cobrança: não gerar outra cobrança automaticamente. Reconciliar no Asaas por referência antes de qualquer nova tentativa.
7. Disponibilizar no painel da loja apenas estado de conexão, método de recebimento e situação de pagamentos; nunca exibir chaves secretas.

## Critérios de aceite para produção

- Duas lojas distintas em Sandbox, com contas de recebimento distintas, geram cobranças vinculadas às respectivas contas.
- Um webhook da loja A não consegue confirmar pedido ou cobrança da loja B.
- Replay de checkout e duplicação/reordenação de webhook não duplicam cobrança nem alteram incorretamente o pagamento.
- Pedido com PIX indisponível permanece rastreável e não é refeito automaticamente.
- Cancelamento, expiração, estorno e conciliação têm estados e tratamento explícitos.
- Testes de segurança de RLS, autorização de lojista e segregação por `store_id` aprovados.
- Build e testes automatizados aprovados; teste ponta a ponta executado em Sandbox.
- Migrações e deploy remoto somente com aprovação explícita.

## Configuração local

- Usar um arquivo exclusivo `supabase/.env.local` (não versionar) para `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `TURNSTILE_SECRET_KEY` na integração Sandbox atual.
- O CLI local pode fornecer `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` ao executar Edge Functions; confirmar no ambiente, sem expor valores.
- O `.env.local` da raiz pode conter apenas variáveis `VITE_*` e não substitui os segredos das funções.
- **Não usar `--no-verify-jwt` em produção.** Para webhooks públicos, configurar autenticação apropriada por função e manter validação do token Asaas.

## Sequência de entrega

1. Confirmar o modelo Asaas de recebimento multi-loja e seus requisitos (não criar subcontas por suposição).
2. Projetar e revisar migration de configuração de recebimento e associação de conta por cobrança.
3. Refatorar adaptador Asaas para cliente por conta/loja, sem expor tokens.
4. Adaptar provisionamento, reconciliação e webhook com vínculo estrito à loja.
5. Implementar testes automatizados de isolamento e eventos repetidos.
6. Validar duas lojas em Sandbox; só depois propor deploy de produção.

**Este documento não executa migrations, não ativa cobranças e não implanta serviços.**
