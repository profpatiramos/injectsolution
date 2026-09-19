# InjectSolution — publicação de 19/09/2026

Aplicativo: https://injectsolution.vercel.app
Repositório: https://github.com/profpatiramos/injectsolution

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
- A integração Bling exige credenciais próprias e não foi ativada. Pedidos podem ser cadastrados manualmente.
- Dados antigos do Manus não foram migrados sem uma exportação do banco de origem. O agente de orçamentos não faz parte desta entrega.
- A ilustração dependente de armazenamento Manus não veio na exportação; foi substituída por uma representação do fluxo na mesma identidade visual.

A cadeia de migração ativa está em drizzle/postgres. Os SQL antigos de MySQL não devem ser executados no Supabase. Consulte docs/supabase-deployment.md para manutenção.
