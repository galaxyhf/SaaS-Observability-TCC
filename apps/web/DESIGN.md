# Dashboard Observa

O usuário acompanha a aplicação em uma tela de trabalho, muitas vezes ao investigar uma lentidão sob pressão. A superfície clara, com contraste alto e azul pontual, favorece leitura em ambientes de escritório e mantém continuidade com a identidade existente.

- Navegação lateral no desktop e horizontal no celular. Visão geral, Atividades e Projeto são telas distintas, identificadas por `view` na URL. O item ativo usa `aria-current`; projeto, período, filtros e página são preservados entre telas. O detalhe pertence a Atividades.
- Primeiro responder volume, falhas e tempo típico. Detalhes de percentis ficam recolhidos.
- Usar “atividade” para trace e “etapa” para span; preservar nomes reais de operações e serviços.
- Busca, período e ambiente sempre disponíveis. Serviço, resultado, duração e ordenação em “Mais filtros”.
- Datas escolhidas e exibidas no horário de São Paulo. Links preservam o intervalo exato, os filtros e a página de retorno.
- Não apresentar status ausente como sucesso. Não inferir indisponibilidade, saúde ou tendência sem dados.
- Gráfico com tabela equivalente; falhas identificadas por texto e cor.
- Inspeção inicia na primeira etapa com erro, quando houver; IDs e JSON ficam em detalhes expansíveis.
- Tokens em `globals.css`; superfícies brancas, fundo frio, azul para ações e seleção, vermelho para falhas.
- Escala tipográfica contida, bordas discretas, sem sombras decorativas. Respeitar foco, teclado e redução de movimento.
