# InjectSolution — atualização de 20/09/2026

Aplicativo: https://injectsolution.vercel.app
Repositório: https://github.com/profpatiramos/injectsolution

## Ajustes de 20/09
- Página Histórico de atividades exclusiva dos administradores, com filtros por funcionário/pedido, ação e período, paginação de 100 registros e atualização a cada 30 segundos. O servidor também omite os logs nos detalhes de pedidos acessados por funcionários. 78 testes aprovados.
- Adicionar item abaixo da lista; categoria selecionável sem apagar “Outros”; telefone removido do cadastro e da lista de pedidos.
- Status no início da linha e check de conferência no final. Observação opcional abaixo de cada item, com salvamento independente e auditoria do status e funcionário. A finalização continua bloqueando alterações.
- Impressão exclusiva da lista de conferência, incluindo observações e nomes dos responsáveis, sem menus, fotos ou painéis da página.
- Admin pode excluir pedidos em andamento ou finalizados, com confirmação e auditoria do responsável e status anterior. Funcionários não podem excluir pedidos. Funcionários e admins podem cadastrar e remover produtos do catálogo sem alterar itens de pedidos existentes.
- Importação Bling preparada para trazer apenas nome do cliente e número do pedido; itens são montados localmente. Uma nova sincronização preserva pedidos existentes e não recria pedidos excluídos pelo administrador.
- Sincronização online de produtos disponível em Produtos para o admin, em lotes de 20 com continuação; mantém o ID do Bling, SKU e unidade, preserva categorias e observações locais e não reativa produtos removidos localmente. A integração lê dados do Bling; não exclui nem altera produtos no ERP.
- 69 testes automatizados, TypeScript e compilação aprovados. Teste com banco real validou catálogo pelo funcionário, observação após conferência, impressão com nome do responsável e exclusão pelo admin após iniciar a separação. Dados sintéticos removidos ao final.
- Catálogo inicial: 224 produtos copiados da lista de estoque do Bling, excluindo os dois registros com nome exato “teste”. Unidade OUTRO até revisão/sincronização. A sincronização futura vincula os SKUs existentes e preserva exclusões locais.
- Busca individual: botão “Buscar pedido no Bling” preenche somente número e cliente, identifica pedido já cadastrado e preserva os itens locais. 74 testes automatizados e compilação aprovados.
- Bling conectado: aplicativo privado autorizado com consulta de Produtos e Pedidos de Venda; credenciais como segredos de produção na Vercel e tokens no banco privado. Busca de um pedido real validada pela tela publicada, preenchendo somente número e cliente, sem criar pedido durante o teste.

## Entregue
- Administração de funcionários e administradores, pré-cadastro, links individuais de acesso e revogação com preservação do histórico.
- Primeiro administrador: vpramos85@gmail.com, com acesso privado preparado para definir a própria senha.
- Botão Salvar fixo no formulário de pedidos, incluindo celular.
- Duas evidências obrigatórias: caixa aberta com produtos e caixa fechada com etiqueta do cliente; funcionário e horário de recebimento registrados pelo servidor.
- Histórico das etapas e fotos. Não inclui ponto de funcionários.
- Bloqueios de edição após separação e finalização; transações e isolamento entre equipes.
- PostgreSQL, Supabase Auth e armazenamento privado de fotos conectados.
- Projeto Vercel publicado e integrado ao repositório GitHub. Credenciais somente no ambiente privado.

## Verificado
- TypeScript sem erros, 59 testes automatizados e compilação concluída.
- Teste com banco real: login, sessão privada, cadastro, pedido, separação, conferência, duas fotos, horários, finalização, bloqueios, revogação, histórico e proteção das oito tabelas.
- Teste pela API publicada: login real de administrador e funcionário, pré-cadastro, permissões, pedido completo, fotos inacessíveis sem sessão, finalização e bloqueio imediato do funcionário excluído.
- Todos os usuários, pedidos e fotos sintéticos criados nos testes foram removidos.
- Tela de login publicada revisada visualmente; formulário e evidências revisados anteriormente em desktop e celular.
- Nenhuma credencial privada encontrada no pacote do navegador. Arquivos .env e links privados são ignorados pelo Git.

## Uso e limites
- Recuperação em `/recover` e retorno Google com PKCE implementados. Troca de senha e uso único do link verificados com conta temporária. SMTP próprio pendente para entrega aos funcionários; Google pendente de aceite da política e conclusão do cadastro OAuth. As opções ainda não estão integralmente ativadas.
- O administrador precisa definir a senha na tela de primeiro acesso aberta para ele.
- Funcionários recebem o link individual compartilhado pelo administrador; não há envio automático de e-mail.
- Validar câmera e legibilidade de uma etiqueta real no celular utilizado pela equipe.
- Bling ativo: em Novo pedido, informe o número e clique em Buscar pedido no Bling. A sincronização é sob demanda; não existe atualização automática por webhook.
- Dados antigos do Manus não foram migrados sem uma exportação do banco de origem. O agente de orçamentos não faz parte desta entrega.
- A ilustração dependente de armazenamento Manus não veio na exportação; foi substituída por uma representação do fluxo na mesma identidade visual.

A cadeia de migração ativa está em drizzle/postgres. Os SQL antigos de MySQL não devem ser executados no Supabase. Consulte docs/supabase-deployment.md para manutenção.
