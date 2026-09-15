# Verificação executada

Data: 15/09/2026. Ambiente Windows, Node.js 24, navegador integrado com JavaScript e API Playwright. A aplicação usa JavaScript puro; não foi instalado Vitest nem um pacote independente de Playwright.

## Testes automatizados

Executado `node --test tests/*.test.mjs`: **54 testes, 54 aprovados, 0 falhas**.

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
