# Dados, fontes e atualização

Data da revisão: **15/09/2026**. URLs, escopos, observações e versão disponível estão em `data/sources.json`. `gameVersion: null` significa versão não informada pela tabela; o banner 3.6 do Wutheringlab não certifica cada custo.

## Fontes e conferências

- **Expansão WUWA Assets:** 57 personagens/formas (51 adicionados) e 153 materiais com imagens locais. Os textos fornecidos em `source-assets/wuwa` determinam as famílias e materiais; a listagem pública do [Akademiya](https://wuwa.akademiya.app/en/characters) complementa nomes, elementos, armas e raridades. O catálogo inclui todas as pastas fornecidas, com Rover Aero, Havoc e Spectro; não implica que todas as entradas estejam em banners atuais.
- A pasta de Luuk Herssen não contém texto. Materiais complementados pelo [guia Game8](https://game8.co/games/Wuthering-Waves/archives/575852): Exoswarm Pendant, Waveworn Shard, Edelschnee, Suncoveter's Reach e Gold in Memory.
- Imagens ausentes vieram da CDN indicada pela página de [materiais do Akademiya](https://wuwa.akademiya.app/en/materials). Os arquivos ficam em `assets/materials`; a aplicação não precisa acessar a CDN em execução.

- Principal: páginas individuais de [Wutheringlab](https://wutheringlab.com/) para Jinhsi, Jiyan, Verina, Yinlin, Sanhua, Encore e as quatro armas. Os links exatos são vinculados aos registros no catálogo.
- Complementar: páginas individuais do Game8, como [Jinhsi](https://game8.co/games/Wuthering-Waves/archives/494451), [Jiyan](https://game8.co/games/Wuthering-Waves/archives/504555) e [Ages of Harvest](https://game8.co/games/Wuthering-Waves/archives/458249).
- EXP e regras: [Resonator/Leveling](https://wutheringwaves.fandom.com/wiki/Resonator/Leveling), [Weapon/Leveling](https://wutheringwaves.fandom.com/wiki/Weapon/Leveling), [Luminal Synthesis](https://wutheringwaves.fandom.com/wiki/Luminal_Synthesis), [Reset](https://wutheringwaves.fandom.com/wiki/Reset) e páginas dos materiais. Algumas páginas diretas da wiki foram bloqueadas; os trechos indexados das tabelas foram consultados. Isso está registrado nas notas.
- [Stringmaster, Theria](https://theriagames.com/guide/wuthering-waves-stringmaster-guide/) complementa a confirmação da família de anéis.
- Eventos: [notícias oficiais de Wuthering Waves](https://wutheringwaves.kurogames.com/en/main/news). Não foi possível confirmar um calendário oficial atual completo.

### Exemplos conferidos manualmente

| Caso | Resultado esperado |
| --- | --- |
| Jinhsi, nível 20 ascensão 0 → nível 20 ascensão 1 | 5.000 Shell Credits e 4 LF Howler Cores; nenhuma EXP |
| Seis ascensões de Jinhsi | 170.000 Shell Credits, 60 Loong Pearls, 46 Elegy Tacet Cores, além dos materiais inimigos por raridade |
| Um Forte, nível 1 → 10 | 280.000 Shell Credits, forja 5/5/8/11, inimigo 5/5/5/9, semanal 4 |
| Ages of Harvest, primeira ascensão | 10.000 Shell Credits e 6 LF Whisperin Cores |
| EXP acumulada de Resonator | nível 20: 33.300; nível 40: 208.800; nível 90: 2.438.000 |
| EXP acumulada de arma 5★ | nível 20: 38.700; nível 40: 226.100; nível 90: 2.692.400 |

As listas de ascensão/Forte são custos **por etapa**, nunca totais cumulativos somados novamente. As tabelas de EXP são **acumuladas** e usadas por diferença.

### Divergências e lacunas

- O texto fornecido da Jinhsi tem totais corretos, mas a tabela por etapa foi copiada da Roccia. A importação usa os materiais corretos do resumo e a tabela previamente conferida da Jinhsi; o arquivo original foi preservado.
- Rover usa um Mysterious Code em cada ascensão de 2 a 6 (cinco no total), em vez de 46 materiais de chefe. Nível/ascensão são compartilhados no planejamento por prioridade e sincronizados ao registrar evolução; Fortes permanecem separados. Metas dependentes aguardam o registro da evolução anterior.
- Os totais de Forte dos textos incluem habilidades inerentes e bônus. O motor calcula os cinco Fortes por nível e os desbloqueios de passivas selecionados na árvore, com custos definidos em `data/rules.json`; não usa o total completo como custo de cada habilidade.

- Uma imagem residual na página de Jinhsi indicava Gloom Slough; a página dedicada e a confirmação Game8 indicam Loong Pearl. O catálogo usa Loong Pearl e registra a divergência.
- Os desbloqueios de passivas usam `unlockCosts` e `unlockAscensions` de `data/rules.json`. Se faltar uma entrada ou material vinculado, o cálculo gera `missingData` e bloqueia a conclusão.
- Duas receitas base (LF → MF Howler/Whisperin) são curadas individualmente em `content/recipes.json`. O compilador deriva conversões Purification 3:1 para famílias válidas de Forja e Inimigos. Não há conversões inversas nem custos adicionais presumidos.
- As estimativas de Farm usam médias padrão por atividade, independentes do Nível de União. Custos de energia das atividades são separados dos drops reais, que podem variar.
- A estimativa semanal informa o limite compartilhado de três resgates; o número de dias calculado por energia não modela completamente o bloqueio por semanas.
- Não há preenchimento com recompensas ou datas fictícias. Recompensas pessoais são sempre identificadas como informadas pelo jogador.

## Manutenção do catálogo

1. Consulte a página individual, uma confirmação complementar quando necessário e registre a data/versão real.
2. Edite os dados curados em `content/`. `scripts/catalog.mjs` valida e compila esses arquivos para `data/`, sem rede nem leitura de `source-assets/`. `scripts/wuwa-reference.json` preserva o snapshot de identidades para atualizações explícitas. Não renomeie IDs já usados em backups sem criar uma migração explícita.
3. Identifique se cada tabela é incremental ou acumulada. Confira um intervalo curto e um total completo independentemente do motor.
4. Defina os indicadores `ascensionVerified`/`forteVerified` somente quando a tabela e o vínculo dos materiais estiverem confirmados. Para dados não disponíveis, mantenha o indicador falso.
5. Execute `npm run catalog`, `npm run data:check`, `npm test` e `npm run build`.
6. Recarregue o site e teste uma meta nova. Se a forma do estado mudar, incremente o formato e implemente migração em `src/storage/state.js` antes de publicar.

Use `npm run catalog:refresh` para atualizar `content/` a partir das fontes externas e brutas e depois compilar `data/`. A geração normal com `npm run catalog` não consulta a rede. A importação exige quatro raridades por família, valida as seis etapas de ascensão e rejeita materiais sem imagem/referência. A exceção explícita da Jinhsi está documentada no importador. Os IDs originais e o formato de backup versão 1 foram preservados.

Os desbloqueios das passivas são validados e calculados em `src/domain/engine.js` com as tabelas de `data/rules.json`. Alterações nos custos exigem conferir essas tabelas e os vínculos de materiais do catálogo.

## Eventos

Os eventos publicados são cadastrados pelo desenvolvedor em `content/events.json`; `npm run catalog` gera `data/events.json`. Jogadores podem marcar ou desmarcar a conclusão. O backup mantém essas conclusões e os eventos pessoais legados, sem editar o catálogo publicado.

`data/events.json` contém a agenda publicada pelo desenvolvedor. `src/domain/official-events.js` valida os registros; a interface mostra eventos pendentes no Resumo e na aba Eventos, e guarda as conclusões do jogador separadamente em `eventCompletions`. Eventos recorrentes podem usar um `anchor` com `everyHours` ou `everyDays`, ou o reset diário/semanal do servidor definido em `data/rules.json`. Não existe atualização automática da agenda nem API pública presumida.

## Retratos e ícones

Retratos locais atribuídos à KURO GAMES, fornecidos na pasta `source-assets/wuwa/`. `source-assets/legacy/character-portraits.json` registra apenas os seis retratos históricos da base original; os caminhos atuais estão em `data/catalog.json`. Os materiais usam imagens canônicas em `assets/materials/`, preservadas das fontes locais ou baixadas do Akademiya. A aplicação mantém uma alternativa visual quando uma imagem falha, inclusive nos diálogos.

## Salvamento e edição

- Uma aba compara o salvamento atual com a cópia que carregou ou gravou por último. Se outra aba alterou ou removeu os dados, novas gravações, desfazer e salvamentos automáticos são bloqueados. Um aviso fixo permite recarregar; a exportação do estado em memória continua disponível.
- As operações de gravação da interface usam um bloqueio compartilhado entre abas quando `navigator.locks` está disponível. Sem essa API, a comparação ainda detecta estados desatualizados, mas não oferece exclusão mútua para gravações exatamente simultâneas.
- As configurações em edição são preservadas em um rascunho durante as atualizações da interface e a navegação interna. O rascunho só entra no salvamento ao clicar em **Salvar configurações**; recarregar ou fechar a página descarta o rascunho, e a exportação contém apenas o estado já confirmado.
- Se o navegador bloquear o acesso ao armazenamento, a aplicação continua em memória e mostra um aviso para exportar backup antes de fechar. Se o acesso de leitura falhar durante a sessão, novas gravações no armazenamento ficam desativadas até recarregar, para evitar sobrescrever dados desconhecidos.

## Expansão de armas — 16/09/2026

120 armas de 1–5★, com imagens locais, custos por etapa e EXP por raridade. A página Weapon and Skill Material da Wiki orienta as famílias; as páginas individuais do Akademiya fornecem as tabelas do snapshot scripts/weapons-reference.json. Boson Astrolabe, Pulsation Bracer e Radiance Cleaver têm complemento das tabelas individuais da Wiki, registrado nas fontes. Laser Shearer e Phasic Homogenizer foram excluídas por falta de custos confirmados.

Para 1–2★, o limite é nível 70/ascensão 4, confirmado na Wiki. O custo anexado à última linha de nível 70 do Akademiya é ignorado: não existe próxima faixa de evolução. EXP de 3★, 2★ e 1★ usa respectivamente 60%, 50% e 40% da tabela de 4★.

O campo EXP parcial foi retirado do planejamento. Valores antigos são preservados quando nível e ascensão atuais não mudam; novos estados começam com zero EXP parcial. A confirmação de evolução mantém seu registro de EXP final. Os IDs das quatro armas originais foram preservados.

## Modal visual e cópias — 16/09/2026

O modal usa abas Nível, Fortes e Arma, mantendo os campos montados durante a troca. A Cadeia de Ressonância (sequence, S0–S6) registra cópias extras, sem alterar os custos de evolução. Backups antigos sem esse campo recebem S0.

Os 57 ícones oficiais de personagem foram baixados da CDN referenciada pelo snapshot público do Akademiya; data/character-art.json registra as URLs. A galeria Fandom solicitada bloqueou o acesso direto (403); o banner usa a arte Convene Draw local existente, em vez de afirmar que é uma Convene Still. Artes de personagens © KURO GAMES. Os três símbolos de aba foram restaurados das imagens enviadas pelo usuário e salvos em PNG RGBA com fundo transparente.

## Grid de armas

A seleção no modal usa cartões com imagem e raridade. Hover/foco revela ATQ e atributo secundário no nível 1 e efeito passivo no refinamento 1; o texto do efeito é preservado em inglês conforme a fonte. data/weapon-stats.json registra os 120 conjuntos de atributos, URL e data de consulta. Atualize explicitamente com node scripts/refresh-weapon-stats.mjs. Esses atributos são informativos e não alteram o cálculo de materiais.

## Resolução dos retratos

Os cards e banners usam artes originais de 696 × 960 em `assets/characters/cards/`, obtidas da CDN referenciada pelo Akademiya. `data/character-art.json` vincula essas versões sem substituir os arquivos fornecidos pelo usuário. `assets/characters/cards/sources.json` registra origem e caminho anterior. Ícones das armas têm 256 × 256 e são exibidos a 64 × 64.

## Arquivos de produção e fontes brutas

`assets/` contém imagens públicas. `source-assets/` guarda arquivos brutos e históricos. `content/` contém os dados estruturados editáveis; `data/` contém os JSONs compilados carregados pelo navegador. As pastas `content/` e `source-assets/` não entram em `dist/`. `scripts/import-wuwa.mjs` lê `source-assets/wuwa/characters/` e `source-assets/wuwa/materials/` apenas na atualização explícita, modifica `content/` e copia imagens de materiais para `assets/materials/`.
