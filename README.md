# InjectSolution — Sistema de Produção

O **InjectSolution** é o MVP operacional para transformar pedidos fechados em listas de separação práticas. A primeira versão centraliza cadastro de pedidos, checklist de itens, conferência de quantidades, registro de divergências, evidências fotográficas e finalização da operação. A experiência foi construída para operação em celular, tablet e desktop, sem exposição de valores comerciais.

> O sistema segue o fluxo: **pedido → lista de separação → conferência → foto → finalização**. A estrutura mantém espaço para importação via Bling e futuros módulos de produção de chicotes.

## Recursos do MVP

| Área | Entrega atual |
| --- | --- |
| Autenticação | Acesso individual por sessão OAuth da plataforma. |
| Isolamento de dados | Pedidos, catálogo, categorias, fotos e auditoria são vinculados ao usuário autenticado. |
| Pedidos | Criação, leitura, edição, exclusão, busca e filtro por status. |
| Separação | Itens por categoria, quantidades solicitadas/separadas/conferidas e estados operacionais. |
| Evidências | Upload de múltiplas imagens por pedido, incluindo captura por câmera em navegadores móveis compatíveis. |
| Finalização | Exige foto; divergências e pendências precisam de confirmação explícita. |
| Catálogo | Produtos e categorias independentes do pedido, preparados para futuro reconhecimento por SKU. |
| Rastreabilidade | Eventos relevantes registrados em auditoria por usuário, horário e pedido. |
| Impressão | Versão limpa da lista operacional, sem valores financeiros. |

## Estrutura do projeto

```text
client/                    # Aplicação React e telas responsivas
  src/components/          # Componentes de marca, status e layout
  src/pages/               # Página inicial, dashboard, pedidos e catálogo
server/                    # API tRPC, regras e acesso ao banco
  domain/                  # Regras puras de conferência e finalização
  routers.ts               # Contratos protegidos consumidos pelo frontend
  services/bling/          # Contrato de adaptação para futura integração
drizzle/                   # Schema e migrations do banco MySQL/TiDB
scripts/seed-catalog.mjs   # Seed manual e idempotente para ambiente de desenvolvimento
docs/                      # Notas de arquitetura e referência visual
```

## Configuração do banco

O projeto usa **MySQL/TiDB** via Drizzle ORM. A migration inicial está em `drizzle/0001_tiny_puff_adder.sql` e cria as entidades de usuários, categorias, produtos, pedidos, itens, fotos, auditoria e configuração futura do Bling.

Na plataforma gerenciada, a conexão do banco é injetada automaticamente. Em ambiente local, crie um banco MySQL compatível e defina `DATABASE_URL` no arquivo `.env`, seguindo a estrutura de `.env.example`. Em seguida, aplique a migration com os comandos abaixo.

```bash
pnpm install
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

## Variáveis de ambiente

Crie manualmente `.env` a partir do modelo seguro em [`docs/environment-template.md`](docs/environment-template.md) e preencha exclusivamente as variáveis requeridas pelo ambiente. **Nunca versione** esse arquivo ou inclua credenciais diretamente no código.

| Variável | Finalidade |
| --- | --- |
| `DATABASE_URL` | Conexão MySQL/TiDB. |
| `JWT_SECRET` | Assinatura de sessão. |
| `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL` | Fluxo de autenticação OAuth. |
| `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Upload seguro das fotos de separação. |
| `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET`, `BLING_REDIRECT_URI` | Reservadas para a futura integração de importação. |
| `SEED_OWNER_ID` | Usada somente no seed manual do ambiente de desenvolvimento. |

## Execução local

Instale as dependências e inicie o modo de desenvolvimento. O servidor expõe o frontend e a API em um único processo.

```bash
pnpm install
pnpm dev
```

Execute as verificações antes de abrir um pull request ou enviar o código ao repositório.

```bash
pnpm check
pnpm test
pnpm build
```

## Dados de demonstração

O seed é deliberadamente manual para nunca criar dados de demonstração em contas reais por acidente. Primeiro faça login uma vez para que o usuário exista no banco. Em seguida, consulte o ID desse usuário no painel do banco e execute:

```bash
SEED_OWNER_ID=1 pnpm exec node scripts/seed-catalog.mjs
```

O script é idempotente e cria categorias operacionais, produtos de referência e o pedido `100001` para **Cliente Teste / Chevrolet Opala / motor 261 / 4 cilindros**. O pedido pode percorrer o fluxo completo de separação.

## Build de produção

```bash
pnpm build
pnpm start
```

O ambiente de produção deve disponibilizar as mesmas variáveis essenciais de banco, autenticação e armazenamento configuradas no arquivo de exemplo.

## Deploy

No ambiente gerenciado, crie uma versão do projeto e utilize a opção **Publish** da interface após configurar as variáveis de ambiente necessárias. Para publicar em infraestrutura externa, utilize um serviço compatível com Node.js, disponibilize um banco MySQL/TiDB, configure um armazenamento S3 compatível e ajuste as URLs de OAuth ao domínio final.

## Como subir este projeto no GitHub

1. Crie um novo repositório privado ou público no GitHub, conforme a política da empresa.
2. Baixe o código pelo painel do projeto ou clone o repositório local correspondente.
3. Confirme que `.env` continua ignorado e que somente `.env.example` será enviado.
4. Execute `git add .`, `git commit -m "feat: mvp de separação InjectSolution"` e `git push origin main`.
5. Adicione as variáveis de produção diretamente no provedor de hospedagem; nunca pelo repositório.

## Próximas evoluções

| Fase | Evolução prevista |
| --- | --- |
| Bling | OAuth 2.0, consulta paginada de pedidos de venda e sincronização idempotente por ID/número. |
| Produção | Lista de fabricação do chicote baseada no mesmo pedido. |
| Perfis | Permissões explícitas para administrador, separador e novos perfis. |
| Catálogo | Sincronização por SKU e ID externo, sem acoplamento ao texto do produto. |
| Comercial | Camada separada para orçamento e preço, sem contaminar a operação de separação. |

## Integração com o Bling

O administrador conecta a conta em **Administração → Importação do Bling**. O fluxo abre a autorização oficial do Bling, retorna ao callback `/api/bling/oauth/callback` e armazena os tokens somente no servidor. Depois da conexão, a ação **Sincronizar 30 dias** consulta `/pedidos/vendas` em páginas, converte os itens para a lista de separação e atualiza pedidos já importados sem duplicá-los. Configure `BLING_CLIENT_ID`, `BLING_CLIENT_SECRET` e `BLING_REDIRECT_URI`; o último deve ser exatamente o callback público cadastrado no aplicativo do Bling.

O endpoint `/api/bling/webhook` valida `X-Bling-Signature-256` quando `BLING_WEBHOOK_SECRET` está configurado e responde rapidamente. O processamento completo permanece sob demanda no painel para evitar bloquear as retentativas do provedor.

## Matriz de perfis

| Perfil | Visualiza pedidos | Executa separação | Cria/edita/exclui pedidos | Catálogo, equipe e Bling |
| --- | --- | --- | --- | --- |
| Administrador | Sim | Sim | Sim | Sim |
| Separador | Sim, no espaço da equipe | Sim | Não | Não |
| Sem perfil | Leitura bloqueada para mutações | Não | Não | Não |

## Teste de campo em celular

Antes da publicação, crie ao menos um usuário com perfil **separador** e valide em um celular real: login, abertura de pedidos, início da separação, marcação individual e em lote, registro de divergência, captura de foto pela câmera, finalização com e sem pendências, comportamento offline momentâneo e retorno após recarregar a página. Registre o modelo do aparelho, navegador, resolução, tempo de carregamento e qualquer toque difícil de executar.

## Critérios de qualidade

O projeto mantém tipagem TypeScript, validação de entradas com Zod, isolamento de dados por usuário em consultas protegidas, regras unitárias para divergência/finalização e estados de carregamento, vazio, sucesso e erro nas ações essenciais da interface.
