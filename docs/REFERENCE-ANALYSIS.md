# Referência funcional e decisões

Consulta em 15/09/2026, usando navegador com JavaScript.

## Observado em SEELIE

Referência: https://seelie.me/planner

- Navegação entre planejamento, personagens, armas, inventário e configurações; localização em português disponível.
- Planejador com categorias de atividades, incluindo permanentes, eventos e tarefas personalizadas, e contagens de tempo.
- Fluxo de adicionar personagem com pesquisa/filtros. Amber foi usada em uma sessão anônima de teste para abrir a configuração de evolução.
- Formulário com nível, talentos, arma e artefatos. O seletor de nível apresenta valores repetidos em limites de ascensão, distinguindo antes/depois da etapa.
- Alterar a meta até o nível 90 atualizou a lista de recursos e o tempo estimado. Custos de Genshin foram observados somente para entender o fluxo; não entraram na base de WuWa.
- Inventário organizado em categorias como recursos comuns, elite, domínio, chefes, semanais, gemas, talentos e especialidades locais. A seleção do personagem se refletia nos materiais relacionados.

## Limites da observação

O carregamento inicial foi lento, mas a aplicação interativa abriu. Foram explorados planejamento, seleção, configuração e inventário. Não foram validados login, sincronização, todos os atalhos, edição em massa do inventário nem a política interna completa de consumo/síntese de SEELIE. Não se presume equivalência desses detalhes.

## Solução própria do Tacet

- Seis páginas com foco na sequência escolher → definir meta → informar estoque → farmar → registrar evolução.
- Nível e ascensão em campos explícitos, com pré-requisitos de Wuthering Waves; cinco Fortes e Nível de União próprios do jogo.
- Reserva de estoque por prioridade, cálculo puro separado da interface, consumo confirmado e desfazer transacional: decisões de implementação próprias.
- Eventos pessoais com datas absolutas e exibição por fuso; catálogo oficial vazio quando não há dados confiáveis.
- Visual escuro, verde suave e detalhes dourados, com retratos locais e navegação adaptada a telas estreitas. Nenhum código ou identidade de SEELIE foi copiado.

## Arquitetura escolhida

JavaScript puro atende a formulários, tabelas, calendário e cálculos deste volume sem adicionar um framework. Dados JSON locais evitam dependência de scraping/API externa durante o uso. `localStorage` comporta o estado pequeno e exportável. O motor puro permite verificar o risco principal — integridade das quantidades — com o test runner nativo do Node. A verificação de fluxos usa a API Playwright disponível no navegador integrado.
