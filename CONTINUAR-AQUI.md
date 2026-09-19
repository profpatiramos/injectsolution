# InjectSolution — continuidade do projeto

## Base preservada em 19/09/2026

Esta é uma cópia do projeto existente em Downloads/injectsolution-updated/injectsolution. O código da aplicação foi preservado, sem recriar o produto ou alterar sua identidade visual. Dependências instaladas, arquivos gerados e logs não fazem parte desta entrega.

O link https://manus.im/share/UW68CRkXNQ0gjD3ROfhNfv mostra o histórico compartilhado da tarefa, com a etapa de permissões interrompida. Ele não permitiu confirmar se existe uma exportação mais recente. A cópia local contém implementação parcial de perfis e Bling.

## Validação da base

- Verificação TypeScript: passou.
- Testes existentes: 11 passaram, em 4 arquivos (separação, isolamento/autorização, Bling e logout).
- Testes executados na origem, que tem as dependências instaladas; código copiado preservado.
- Login real, banco, fotos, integração Bling e fluxo completo em navegador ainda não foram validados nesta tarefa.

## Ordem de continuidade

1. Conectar o ambiente de desenvolvimento às configurações autorizadas de autenticação, banco e fotos; consultar docs/environment-template.md. Não colocar credenciais no código ou na conversa.
2. Reproduzir a falha dos botões de entrada. O código usa VITE_OAUTH_PORTAL_URL e VITE_APP_ID, ausentes no pacote local; a URL de entrada pode falhar quando essas configurações não existem.
3. Completar e testar permissões de administrador e separador, incluindo o vínculo à equipe.
4. Corrigir o bloqueio de alterações após finalização: atualmente as operações de itens/fotos não verificam finalizedAt. Revisar também edição do pedido e sincronização do Bling para preservar a conferência.
5. Validar criação de pedido, catálogo, separação, conferência, foto, finalização, histórico e impressão em computador e celular.
6. Salvar uma versão validada. Depois tratar a independência da Manus e, em etapa própria, integrar o agente de orçamentos.

O estado atual é uma base importada e testada parcialmente, não uma versão final pronta para produção.
