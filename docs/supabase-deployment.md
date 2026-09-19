# Publicação do InjectSolution

A aplicação usa PostgreSQL, Supabase Auth e um bucket privado. A API Express executa na Vercel e verifica permissões em cada operação. As chaves privadas ficam somente no servidor.

## Configuração

1. Conectar o banco Supabase exclusivo `injectsolution` ao projeto Vercel correspondente.
2. Preencher `.env.example`. A integração Vercel fornece `POSTGRES_URL`, `SUPABASE_URL`, as chaves privadas e as variáveis públicas `VITE_SUPABASE_*`. Gerar um `JWT_SECRET` aleatório de pelo menos 32 caracteres e configurar `PUBLIC_APP_URL` com o endereço de produção.
3. Em Supabase Authentication > URL Configuration, definir o endereço do aplicativo e permitir exatamente `https://SEU-DOMINIO/setup`. Adicionar o endereço local explicitamente para testes, sem curingas de produção.
4. Executar `pnpm db:migrate` e `pnpm db:storage`. A migração ativa RLS nas oito tabelas, sem políticas públicas: as consultas operacionais passam pelo servidor. O bucket `order-evidence` é privado.
5. Executar `pnpm admin:bootstrap`. O primeiro administrador é `vpramos85@gmail.com`. O comando preserva cadastros existentes e grava um link único no arquivo ignorado `.env.admin-access`; o próprio administrador abre o link e define sua senha. Não enviar esse arquivo ao repositório.
6. Validar login, pedido com vários itens, separação, conferência, as duas fotos, finalização e revogação de funcionário no ambiente publicado.

## Equipe

O administrador cadastra nome, e-mail e perfil antes do primeiro acesso. Depois gera um link individual na lista e o compartilha privadamente com a pessoa. O sistema não envia mensagens automaticamente. O link permite definir ou recuperar a senha, expira e só pode ser utilizado uma vez. As permissões vêm do banco, nunca dos dados fornecidos pelo navegador.

Excluir um funcionário revoga o acesso e preserva a autoria do histórico. A API verifica a revogação em cada requisição, mesmo quando ainda existe um cookie de sessão.

## Compatibilidade com a origem

Os arquivos SQL antigos na raiz de `drizzle/` documentam o MySQL da versão Manus. **Não os executar no Supabase.** A cadeia ativa está em `drizzle/postgres/`. Dados existentes do Manus não foram migrados automaticamente: essa transferência exige uma exportação autorizada do banco original. O código original foi preservado fora desta cópia.

## Fotos e validação

O aplicativo reduz fotos grandes antes do envio, mantendo até 2400 pixels no maior lado e 3 MiB por arquivo. A finalização exige foto da caixa aberta e da caixa fechada. A API registra o horário de recebimento e o usuário, verifica o vínculo com a equipe e fornece acesso temporário à imagem. Validar a legibilidade da etiqueta em um celular real.

Executar `pnpm check`, `pnpm test` e `pnpm build`. Testes isolados não substituem a validação com banco, login e armazenamento reais. A integração Bling requer credenciais próprias e permanece opcional.
