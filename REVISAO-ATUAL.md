# InjectSolution — estado em 19/09/2026

A cópia original foi preservada. Esta pasta contém a continuação do projeto.

## Implementado
- Administração de funcionários e administradores, pré-cadastro, revogação e preservação do histórico. Administrador inicial: vpramos85@gmail.com.
- Botão Salvar fixo no formulário, incluindo celular.
- Duas evidências obrigatórias: caixa aberta com produtos e caixa fechada com etiqueta do cliente; identificação do funcionário e horário recebido pelo servidor.
- Acompanhamento de etapas e fotos; não inclui ponto de funcionários.
- Bloqueios de edição após separação e finalização, transações e isolamento entre equipes.
- Adaptação para PostgreSQL, Supabase Auth e fotos privadas, com login e definição de senha por link individual.
- Configuração da API para publicação na Vercel.

## Verificado
- TypeScript sem erros.
- 59 testes passaram, incluindo autenticação, autorização, regras e persistência simulada.
- Compilação do cliente e servidor concluída.
- Formulário e evidências revisados visualmente em desktop e celular em ambiente simulado.
- Banco Supabase exclusivo injectsolution criado no plano gratuito, em São Paulo. Ainda não conectado à aplicação.
- Permissão de envio ao GitHub profpatiramos/injectsolution confirmada por teste sem publicação.

## Pendente
- Autorização específica para copiar as credenciais privadas, solicitada após bloqueio da revisão automática.
- Aplicar a migração e configurar o bucket privado no banco real.
- Configurar endereço público, redirecionamentos do login e primeiro acesso do administrador.
- Testar o fluxo completo com banco, autenticação e fotos reais.
- Enviar a versão validada ao GitHub e criar/publicar o projeto Vercel.
- Credenciais Bling, exportação de dados da origem e agente de orçamentos não foram configurados.

A aplicação ainda não está publicada nem declarada pronta para produção. Consulte docs/supabase-deployment.md para os passos de configuração. Os SQL antigos de MySQL não devem ser executados no Supabase; a cadeia ativa está em drizzle/postgres.
