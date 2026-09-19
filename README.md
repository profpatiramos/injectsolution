# InjectSolution

Sistema de produção para pedidos, separação, conferência e evidências fotográficas.

Tecnologias: React, TypeScript, Vite, Express, tRPC, Drizzle/PostgreSQL e Supabase Auth/Storage. Hospedagem preparada para Vercel.

Consulte **REVISAO-ATUAL.md** para o estado verificado e pendências, e **docs/supabase-deployment.md** para configuração e publicação.

## Desenvolvimento

Instale com pnpm install --frozen-lockfile. Copie .env.example para .env e preencha a configuração privada. Execute pnpm db:migrate e pnpm db:storage após conectar o banco. Execute pnpm dev para desenvolvimento.

Verificações: pnpm check, pnpm test e pnpm build.

Nunca publique arquivos .env, links privados de primeiro acesso ou credenciais. O primeiro acesso do administrador é preparado por pnpm admin:bootstrap e deve ser entregue privadamente ao titular da conta.
