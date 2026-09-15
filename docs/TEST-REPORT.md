# Verificação executada

Data: 15/09/2026. Ambiente Windows, Node.js 24, navegador integrado com JavaScript e API Playwright. A aplicação usa JavaScript puro; não foi instalado Vitest nem um pacote independente de Playwright.

## Testes automatizados

Verificação inicial: `node --test tests/*.test.mjs`, **54 testes aprovados**.

Revisão de persistência e formulários em 15/09/2026: **68 testes, 68 aprovados, 0 falhas**, executados com Node.js 24.19.0. O executável foi localizado fora do PATH; não foi necessário instalar dependências. `node scripts/build.mjs` também passou.

Cobertura:

- Estado igual à meta, metas regressivas, limite de nível antes/depois de ascender, ascensão incompatível e limites dos Fortes.
- Exemplos de custos conferidos nas fontes: ascensões de Jinhsi, um Forte completo, primeira ascensão de Ages of Harvest e limites das tabelas acumuladas de EXP.
- Estoque zero, insuficiente, suficiente e excedente; dois personagens compartilhando materiais e mudança de prioridade; cálculo sem mutar a entrada.
- EXP parcial, sobra mínima, desempate por quantidade de consumíveis, estoque insuficiente e reserva única de poções.
- Síntese impedida quando consumiria materiais reservados; proporção real LF/MF; estoque alterado apenas pela operação confirmada.
- Evolução seguida de desfazer, Nível de União insuficiente, lacunas de dados e arma incompatível.
- Registro de consumo real, devoluções, rejeição de EXP sem consumo suficiente e créditos insuficientes; preservação de EXP parcial em evolução somente de habilidade.
- Tentativas arredondadas para cima, Waveplates e ausência de estimativa automática para mundo aberto.
- JSON inválido, formato inválido, quantidade negativa, duplicatas, IDs desconhecidos, chave de protótipo, mesclagem idempotente e round-trip de backup.
- Recuperação de salvamento corrompido, falha de quota e migração do formato mínimo v0.
- Recompensas de eventos registradas uma única vez, datas inválidas, fuso explícito obrigatório, limites de início/término, resets diário/semanal e agrupamento por fuso.

## Fluxos executados no navegador

1. Selecionar Jinhsi, configurar nível 20 ascensão 0 → nível 20 ascensão 1 e salvar: exibidos 5.000 Shell Credits e 4 LF Howler Cores, sem EXP.
2. Preencher inventário, observar meta pronta a 100% e recarregar: valores e reserva persistiram.
3. Configurar Nível de União 10, registrar evolução e confirmar: materiais consumidos e ascensão atualizada. Desfazer restaurou ambos.
4. Adicionar Jiyan com a mesma ascensão: a segunda meta recebeu apenas o estoque restante. Aumentar sua prioridade transferiu a reserva, deixando a antiga primeira meta incompleta.
5. Criar evento pessoal com duas tarefas e 100 Shell Credits previstos; concluir checklist e confirmar recebimento: estoque atualizado uma vez.
6. Importar JSON malformado: erro visível, sem substituir dados. Importar formato v0 válido e mesclar: estoque passou de 5.100 para 5.200, sem soma duplicada. Substituição por backup vazio removeu os dados de QA ao terminar.
7. Revisar resumo, agenda, calendário e formulário de meta com viewport de 390 × 844. Largura útil 375 px, sem transbordamento horizontal da página nos estados verificados. A navegação foi ajustada para duas linhas legíveis.
8. Ferramenta opcional WebMCP: consulta leu metas reais; parâmetro extra foi rejeitado; abertura de formulário para Jiyan retornou `saved: false` antes da confirmação do usuário.
9. Consulta ao log de erros do navegador após recarregar: nenhum erro registrado.

## Limites da verificação

Não foi feita auditoria formal WCAG, teste com leitor de tela, teste de todos os navegadores/dispositivos ou validação do catálogo inteiro do jogo. O catálogo local contém seis personagens e quatro armas. Bloqueios de fontes, regras não verificadas, eventos pessoais e limites das estimativas estão descritos em `DATA.md` e no README. Os testes verificam os cálculos para as tabelas locais; não certificam que futuras atualizações do jogo mantenham esses valores.

## Regressões de persistência e formulários

Os 14 novos testes cobrem:

- Rejeição de gravação por uma aba antiga, inclusive antes da chegada do evento `storage`.
- Proteção de desfazer, histórico e salvamento automático; remoção do salvamento; identificação da área de armazenamento correta; retomada após recarregar.
- Serialização das operações usando uma fila que simula Web Locks e comparação de versões sem essa API.
- Acesso a `localStorage` bloqueado, falha de leitura durante a sessão, falta de espaço e recuperação de gravação após a quota voltar a permitir.
- Inicialização e edição de inventário pelo código real de `app.js`, com acesso ao armazenamento bloqueado e as interfaces do navegador simuladas.
- Edição de evento importado com cinco recompensas, manutenção de recompensas já resgatadas e restauração do rascunho de configurações.

Validação adicional no Brave, em `http://localhost:5173`:

1. Alterar Waveplates/dia de 240 para 123, tirar o foco do campo e deixar a página aberta por 70 segundos: o rascunho permaneceu em 123 e pôde ser salvo.
2. Abrir duas abas antes da alteração: a segunda recebeu um aviso fixo. Tentar salvar 200 na aba antiga foi rejeitado; **Recarregar dados** trouxe 123, preservando a gravação da primeira aba.
3. Mesclar um evento pessoal com cinco recompensas, abrir o editor e alterar apenas o título: as cinco recompensas e quantidades permaneceram no evento salvo.
4. O log de erros do navegador não apresentou erros. As alterações de teste foram desfeitas ao final.

O bloqueio do armazenamento foi simulado nos testes automatizados; as configurações de segurança do navegador não foram alteradas. O teste de fila usa uma simulação de exclusão mútua; o fluxo de conflito entre duas abas foi verificado também no navegador real.
# Expansão WUWA Assets — 15/09/2026

- `node --test tests/*.test.mjs`: **76 testes passaram**, incluindo oito novos testes do catálogo.
- Cobertura: todas as pastas fornecidas; 57 personagens/formas; arquivos de imagem de todos os personagens e 153 materiais; builds completos com IDs válidos; backup dos novos materiais; correção da tabela colada na Jinhsi; materiais de Luuk Herssen; compartilhamento de nível/ascensão do Rover com Fortes independentes, sem consumo duplicado.
- `node scripts/catalog.mjs`: regeneração offline concluída com os 57 personagens e 153 materiais.
- `node scripts/build.mjs`: build validado em `dist/`.
- Navegador: catálogo com 57 opções carregou; retratos do início da lista conferidos por screenshot; busca por Rover retornou as três formas.
- Limitação da verificação visual: após alterações finais no seletor e na integração WebMCP, a conexão do navegador ao localhost falhou com `ERR_CONNECTION_REFUSED`. O servidor respondeu HTTP 200 na verificação pelo terminal. Diálogos, inventário e mobile não tiveram conferência visual final nesta execução.

---

## Tema do logo — 15/09/2026

Logo sem subtítulo conferido no desktop e no topo mobile a 390 × 844. Tipografia original (DM Sans/Manrope) restaurada conforme pedido. Inventário conferido visualmente com o tema azul e marfim. Build concluído; os 76 testes existentes passaram.

## Menu e retratos — 15/09/2026

Destaque móvel do menu com duração de 320 ms e preferência de movimento reduzido respeitada. Navegação até Inventário conferida com indicador alinhado ao destino. Retratos com preenchimento e zoom conferidos por screenshot no desktop e a 390 × 844. Os 76 testes existentes passaram; build e diff check concluídos.
