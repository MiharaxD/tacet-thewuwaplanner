# Dados, fontes e atualização

Data da revisão: **15/09/2026**. URLs, escopos, observações e versão disponível estão em `data/sources.json`, visíveis também em Configurações. `gameVersion: null` significa versão não informada pela tabela; o banner 3.6 do Wutheringlab não certifica cada custo.

## Fontes e conferências

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

- Uma imagem residual na página de Jinhsi indicava Gloom Slough; a página dedicada e a confirmação Game8 indicam Loong Pearl. O catálogo usa Loong Pearl e registra a divergência.
- Nós inerentes/bônus apresentaram divergências de custos ou pré-requisitos. Seus aumentos geram `missingData` e bloqueiam a conclusão. Os valores atuais digitados pelo usuário são registros pessoais, não uma verificação dos pré-requisitos desses nós.
- Só duas receitas de síntese foram verificadas: LF → MF Howler/Whisperin, proporção 3:1. Não há conversões inversas, equivalências genéricas nem supostos custos adicionais.
- Não há tabela automática de rendimento por Nível de União. O rendimento médio é uma premissa explícita do jogador. Custos de energia de atividades são separados de drops.
- A estimativa semanal informa o limite compartilhado de três resgates; o número de dias calculado por energia não modela completamente o bloqueio por semanas.
- Não há preenchimento com recompensas ou datas fictícias. Recompensas pessoais são sempre identificadas como informadas pelo jogador.

## Manutenção do catálogo

1. Consulte a página individual, uma confirmação complementar quando necessário e registre a data/versão real.
2. Edite `scripts/catalog.mjs`: acrescente fontes, materiais com IDs estáveis, personagem/arma e referências. Não renomeie IDs já usados em backups sem criar uma migração explícita.
3. Identifique se cada tabela é incremental ou acumulada. Confira um intervalo curto e um total completo independentemente do motor.
4. Defina os indicadores `ascensionVerified`/`forteVerified` somente quando a tabela e o vínculo dos materiais estiverem confirmados. Para dados não disponíveis, mantenha o indicador falso.
5. Execute `node scripts/catalog.mjs`, revise `data/`, acrescente testes de fronteira e execute os testes e o build.
6. Recarregue o site e teste uma meta nova. Se a forma do estado mudar, incremente o formato e implemente migração em `src/state.js` antes de publicar.

Os desbloqueios ainda não têm um motor de custos. Confirmar suas fontes exige adicionar as tabelas, validação de pré-requisitos e cálculo em `engine.js`; trocar uma etiqueta da interface não basta.

## Eventos

**Atualização disponível sem programação:** crie/edite um evento na página Eventos usando datas do servidor configurado. A interface converte para um instante UTC e exibe no fuso selecionado. Cadastre apenas recompensas que você conferir no jogo. O backup leva esses eventos para outro navegador.

`data/events.json` permanece vazio como reserva de catálogo; preencher esse arquivo sozinho não publica eventos na interface atual. Para oferecer um catálogo oficial no futuro, adicione ingestão e validação de registros com fonte, data de consulta, servidor, início/fim com fuso e recompensas verificadas; mantenha o progresso do usuário separado dos registros oficiais e preserve a distinção visual `official`/`personal`. O estado atual aceita somente eventos pessoais para impedir que uma importação se passe por catálogo oficial. Não existe atualização automática nem API pública presumida.

## Retratos e ícones

Retratos locais atribuídos à KURO GAMES, obtidos via Wutheringlab; URLs e metadados estão em `assets/character-portraits.json`. A aplicação mostra uma alternativa visual quando uma imagem falha. Os ícones de materiais são identificadores estilizados próprios, acompanhados do nome e da raridade, e não reproduções das artes oficiais.
