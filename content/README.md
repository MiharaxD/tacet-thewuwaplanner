# Edição dos dados do Tacet Planner

`content/` é a fonte de verdade dos dados curados. Não edite os JSONs compilados de `data/` diretamente.

| Para alterar | Edite |
| --- | --- |
| Ressonante e sua arte | `characters/<id>.json` |
| Arma | `weapons/<tipo>.json` |
| Material | `materials/<grupo>.json` |
| Progressão, EXP e custos | `config/progression.json` |
| Atividades e Waveplates | `config/activities.json` |
| Servidores e resets | `config/servers.json` |
| Eventos publicados | `events.json` |
| Síntese | `recipes.json` |
| Referências | `sources.json` |
| Tradução dos Fortes | `forte-descriptions-pt.json` |

`manifest.json` preserva a ordem dos personagens, armas, materiais, artes e campos de regras. Ao adicionar um ID, inclua-o na lista de ordem correspondente. IDs devem ser únicos; o nome de cada arquivo de personagem deve corresponder ao seu ID.

`recipes.json` contém só receitas curadas manualmente. As receitas `purify-*` (Purification 3:1) são derivadas dos materiais durante `npm run catalog` e aparecem apenas em `data/recipes.json`. Não as edite em `content/`. Se uma receita curada produzir o mesmo material, ela tem precedência e a receita derivada correspondente não é adicionada.

Depois de editar, execute `npm run catalog`, `npm run data:check`, `npm test` e `npm run build`. O build apenas verifica a sincronia; ele não reescreve `data/`.

`npm run catalog:refresh` usa detecção otimista de concorrência: se o projeto mudar durante a atualização, aborta sem sobrescrever edições manuais. Se uma edição ocorrer depois de um arquivo já ter sido instalado, o rollback restaura o estado anterior e guarda a edição em `.refresh-conflict-recovery-*`; o erro informa o caminho para recuperá-la. Execute o refresh novamente após resolver o conflito. Execute importadores somente pelo comando `catalog:refresh`, que os isola em uma workspace temporária.

`data/character-fortes.json` e `data/weapon-stats.json` são caches produzidos pelos scripts de atualização, não fontes de edição manual. `source-assets/` guarda evidência bruta; `assets/` guarda imagens públicas. Nem `content/` nem `source-assets/` entram na publicação.
