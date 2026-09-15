# Tacet — Wuthering Waves Planner

Planner local com 57 personagens/formas, 153 materiais com imagens, metas de nível/ascensão/Forte, inventário e planejamento de farm.

## Abrir

Com Node.js 22 ou superior, execute na pasta do projeto:

```sh
node scripts/serve.mjs
```

Abra [o planner local](http://127.0.0.1:5173). Metas e inventário ficam salvos no navegador; use Configurações para exportar backups.

## Dados e validação

```sh
node scripts/catalog.mjs
node --test tests/*.test.mjs
node scripts/build.mjs
```

O build fica em `dist/`. Para atualizar as referências do Akademiya e baixar imagens ausentes, execute `node scripts/catalog.mjs --refresh`. A geração normal usa os textos em `assets/WUWA Assets` e o snapshot local, sem rede.

O Rover compartilha nível e ascensão entre os três elementos cadastrados; Fortes são independentes. Custos dos nós inerentes/bônus ainda não estão cobertos. Fontes, exceções e manutenção estão em [docs/DATA.md](docs/DATA.md).

## Identidade visual

Logo fornecido em `assets/logo`, servido como cópia PNG em `assets/logo.png`, sem subtítulo. Tema quase preto com nuances de azul e detalhes em marfim com estrelas de quatro pontas e contornos curvos. Tipografia original mantida: DM Sans e Manrope.
