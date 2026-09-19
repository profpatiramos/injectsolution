# Roteiro de teste de campo em celular

## Objetivo

Validar a operação real do perfil **separador** em um celular, com foco em leitura rápida, toque confortável, câmera e recuperação após recarregar a página.

## Preparação

O administrador deve criar ou localizar um usuário de teste, atribuir o perfil `separador` e garantir que exista pelo menos um pedido com dois ou mais itens, incluindo um item que permita registrar divergência. Também deve existir uma conexão do Bling ou um pedido cadastrado manualmente para o teste.

| Campo a registrar | Valor |
| --- | --- |
| Aparelho e sistema |  |
| Navegador e versão |  |
| Tamanho da tela |  |
| Rede usada |  |
| Data, hora e testador |  |

## Casos de aceite

| Caso | Procedimento | Resultado esperado |
| --- | --- | --- |
| Login | Abrir o sistema e entrar com o usuário separador | O menu mostra Visão geral e Pedidos; não mostra catálogo, novo pedido ou Administração. |
| Abrir pedido | Acessar um pedido e iniciar separação | A tela carrega sem rolagem horizontal e o botão de início é fácil de tocar. |
| Conferência | Marcar um item e ajustar quantidades | O status do item muda e permanece após recarregar a página. |
| Lote | Usar “marcar todos” e depois desfazer | Todos os itens acompanham a ação, sem duplicidade ou perda de dados. |
| Divergência | Informar quantidade parcial ou item não encontrado | A divergência fica explícita e o pedido não é concluído silenciosamente. |
| Foto | Capturar uma evidência pela câmera traseira | A imagem aparece na lista e pode ser removida. |
| Finalização | Tentar finalizar sem foto e depois com pendência confirmada | Sem foto, o sistema bloqueia; com confirmação, registra o resultado correto. |
| Persistência | Fechar e reabrir o navegador após uma alteração | O pedido mantém status, quantidades, responsável e evidências. |
| Acesso direto | Abrir `/orders/new`, `/products` e `/admin` no celular | O separador recebe tela de acesso restrito e nenhuma mutação é permitida. |

## Registro de defeitos

Para cada problema, registrar o caminho da tela, o toque realizado, o resultado observado, o resultado esperado, uma captura de tela sem dados sensíveis e o modelo do aparelho. Classificar como **bloqueador**, **alto**, **médio** ou **baixo**. A publicação só deve ocorrer quando não houver bloqueador ou falha alta nos casos de login, conferência, foto e finalização.
