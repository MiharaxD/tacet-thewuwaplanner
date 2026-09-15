# Tacet · Wuthering Waves Planner

Aplicação funcional em português para metas de evolução, inventário compartilhado, farm e eventos pessoais. HTML, CSS e JavaScript puro com ES Modules, sem dependências de execução ou framework de interface.

## Executar

Requer Node.js 22 ou superior. Na pasta do projeto:

```sh
node scripts/serve.mjs
```

Abra http://127.0.0.1:5173. Não abra `index.html` diretamente: módulos e arquivos JSON precisam de um servidor HTTP.

```sh
node --test tests/*.test.mjs
node scripts/build.mjs
node scripts/serve.mjs dist
```

O segundo comando gera `dist/`, pronto para hospedagem estática. Pare o servidor anterior antes de iniciar outro na mesma porta. Também há scripts equivalentes em `package.json`, se npm estiver instalado. Nenhuma instalação de pacotes é necessária.

## Usar

1. Em **Personagens**, selecione um Resonator e informe o estado atual e a meta. Nível e ascensão são campos separados.
2. Defina Fortes e, se desejar, uma arma compatível. O formulário mostra uma prévia de custos.
3. Em **Inventário**, registre apenas os materiais que você possui. Tudo é salvo automaticamente neste navegador.
4. Em **Resumo**, use as setas para distribuir o estoque por prioridade. **Ver materiais** explica a reserva de cada meta.
5. Em **Farm**, veja as faltas e informe seu rendimento médio para estimar tentativas, Waveplates e dias de energia.
6. Após evoluir no jogo, use **Registrar evolução**, confira os itens realmente consumidos e confirme. **Desfazer** restaura tanto o estoque quanto o personagem.
7. Em **Eventos**, cadastre datas no horário do servidor, tarefas e recompensas previstas. Concluir uma tarefa não entrega recursos automaticamente: registre o recebimento separadamente.

## Cobertura e limites reais

- **6 personagens:** Jinhsi, Jiyan, Verina, Yinlin, Sanhua e Encore.
- **4 armas de 5 estrelas:** Ages of Harvest, Verdant Summit, Stringmaster e Emerald of Genesis.
- **47 materiais**, EXP de níveis 1–90, ascensões e cinco Fortes; **2 receitas** verificadas de síntese LF → MF.
- Habilidades inerentes e bônus podem ser planejados, mas seus custos/pré-requisitos ainda não foram conciliados entre as fontes. Metas que exigem esses desbloqueios são marcadas como não verificadas e não podem ser registradas como realizadas.
- A base é uma seleção inicial, não o catálogo completo nem uma atualização automática do jogo. Não inclui Ecos, afinadores, equipamentos fora das quatro armas ou materiais de outras raridades de arma.
- Eventos oficiais atuais não foram confirmados em uma fonte confiável: o calendário entregue é pessoal e funcional. Não há datas ou recompensas oficiais demonstrativas.
- Drops médios são informados pelo jogador. Mudar o Nível de União limpa esses rendimentos, pois podem deixar de representar sua conta. Dias estimados representam energia; não incluem toda a espera por resets semanais ou reaparecimento no mundo.
- A sugestão de EXP minimiza sobra, depois quantidade de itens. Créditos previstos usam a EXP necessária. Ao concluir, confira o consumo real, EXP final e devoluções do jogo; não há simulação automática de devoluções por limite de ascensão. Se ultrapassou o nível desejado, ajuste a meta antes de concluir.
- O progresso é a média das proporções atendidas por tipo de recurso; não representa tempo, valor ou quantidade de ações no jogo.

## Motor e arquitetura

| Arquivo | Responsabilidade |
| --- | --- |
| `data/*.json` | Catálogo local, regras, receitas, fontes e reserva para eventos oficiais |
| `src/engine.js` | Funções puras de validação, custos, alocação, EXP, síntese, evolução e farm |
| `src/state.js` | Estado versão 1, validação de backups, migração, persistência e desfazer |
| `src/time.js` | Datas absolutas, resets e apresentação por fuso |
| `src/ui.js` | Componentes HTML e escape de texto |
| `src/app.js` | Seis páginas, formulários e ações |
| `src/styles.css` | Identidade visual e comportamento responsivo |
| `src/webmcp.js` | Integração opcional com agentes em navegadores compatíveis |
| `tests/engine.test.mjs` | Testes do motor, estado e datas usando Node Test Runner |

Custos de ascensão e Fortes são **incrementais por etapa**. EXP é uma tabela **acumulada**: subtrai-se o valor do nível inicial e a EXP parcial. Nível 20 antes de ascender e nível 20 após ascender produzem custos diferentes. O motor percorre as metas em ordem, retira reservas de uma cópia do inventário e nunca reutiliza a mesma unidade em duas metas. `falta = max(0, necessário − alocado)`. Planejar não altera o estoque real. Sínteses usam somente recursos não reservados e exigem confirmação. A evolução cria uma transação validada; o histórico mantém até 20 estados enquanto a página está aberta.

Backups são validados antes de revisão e confirmação. **Mesclar** usa o maior estoque por material e preserva metas/eventos/configurações atuais quando há conflito; importar duas vezes não duplica quantidades. **Substituir** troca o estado inteiro e permite desfazer. O formato v0 aceito é exclusivamente `{ "version": 0, "inventory": { ... } }`; outros campos são recusados para evitar perda silenciosa. Formatos desconhecidos são rejeitados.

`localStorage` mantém dados apenas neste navegador/origem, sem conta ou sincronização. Um salvamento corrompido é preservado para recuperação quando o armazenamento permite. Falhas de quota são sinalizadas; alterações permanecem em memória e podem ser exportadas. Ao trocar de dispositivo ou endereço, use exportação/importação. A página avisa quando outra aba salva, mas não oferece edição simultânea com resolução de conflitos.

## Atualizar dados e verificar

Leia [Procedência e manutenção](docs/DATA.md), [Análise da referência](docs/REFERENCE-ANALYSIS.md) e [Relatório de testes](docs/TEST-REPORT.md).

As tabelas editáveis são geradas por `scripts/catalog.mjs`. Atualize esse arquivo e execute `node scripts/catalog.mjs`; revise o JSON resultante, rode os testes e refaça o build. Não marque algo como verificado apenas porque existe na interface.

## Dependências, acessibilidade e créditos

O servidor, build e testes usam recursos nativos do Node. A interface depende apenas de APIs do navegador; as fontes Google são opcionais, com alternativas locais do sistema. Retratos são arquivos locais, carregados sob demanda. Ícones da interface e identificadores de materiais são SVG próprios; não são imagens oficiais dos materiais. As imagens de personagens pertencem à KURO GAMES e foram obtidas no Wutheringlab, com procedência registrada em `assets/character-portraits.json`.

Há rótulos de formulário, foco visível, diálogo nativo, link para pular navegação, mensagens de erro e estados descritos em texto. A revisão visual não substitui uma auditoria completa com leitores de tela.

SEELIE foi referência funcional; não foi usado seu código, marca ou identidade visual. Projeto de fã sem afiliação à KURO GAMES.

Em navegadores com WebMCP, `read_tacet_plan` consulta o planejamento e `start_tacet_goal` abre um formulário sem salvar ou consumir estoque. Em outros navegadores, a aplicação segue funcionando normalmente.
