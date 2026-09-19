# Validação de Acessibilidade do MVP

Esta validação cobre as telas essenciais do fluxo de descoberta e operação: página inicial, dashboard, listagem de pedidos, cadastro de pedido e detalhe/lista de separação. A revisão foi feita sobre a implementação e em viewports de smartphone e desktop.

| Critério | Verificação aplicada | Resultado |
| --- | --- | --- |
| Estrutura semântica | O conteúdo principal usa `header`, `main`, `nav`, `section`, `article`, `aside`, `table`, `thead` e `tbody` conforme o contexto. | Atendido |
| Navegação por teclado | Foco visível global foi definido para links, botões, campos, seletores e áreas de texto. | Atendido |
| Controles por ícone | Botões de menu, excluir, abrir, editar, ampliar, fechar e alternar conferência incluem `aria-label`. | Atendido |
| Formulários | Campos essenciais possuem rótulos visíveis; campos obrigatórios usam `required` e as validações do servidor devolvem mensagens em português. | Atendido |
| Imagens | A imagem de apoio na página inicial e as fotos de evidência usam texto alternativo descritivo. | Atendido |
| Estados essenciais | Telas operacionais apresentam estados de carregamento, vazio, erro, sucesso e ação desabilitada durante envio. | Atendido |
| Contraste | A interface utiliza fundo preto/grafite com texto branco, ou superfícies brancas com texto grafite, mantendo o vermelho como destaque de ação. | Atendido na revisão visual |
| Mobile | A página inicial, dashboard, lista e formulário foram visualmente verificados em 375 × 812 px; botões e entradas mantêm área de toque confortável. | Atendido |
| Impressão | Elementos de navegação são ocultados e a lista operacional preserva identificação, itens, quantidades e status. | Atendido |

> Esta é uma revisão de implementação e interação básica. Antes de liberar a operação para uma equipe maior, recomenda-se realizar uma avaliação com usuários reais de oficina, incluindo pessoas que utilizam leitores de tela ou navegação exclusivamente por teclado.
