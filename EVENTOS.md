# Como cadastrar eventos no Tacet

Você administra a agenda pelo arquivo `data/events.json`. Os jogadores recebem a lista publicada e só podem marcar/desmarcar **Concluí este evento**. Não existe formulário público para criar, editar ou excluir eventos.

## 1. Edite o arquivo

Exemplo ilustrativo (não foi adicionado à agenda):

```json
{
  "version": 1,
  "events": [
    {
      "id": "evento-versao-01",
      "title": "Nome do evento",
      "start": "2026-09-20T10:00:00-03:00",
      "end": "2026-10-04T10:00:00-03:00"
    }
  ]
}
```

- `id`: identificador único, sem espaços ou acentos. Use letras, números, hífen e sublinhado. **Mantenha o mesmo ID ao corrigir um evento**, pois ele vincula as marcações dos jogadores. Cada nova edição de um evento deve ter um ID novo.
- `title`: nome exibido, até 120 caracteres.
- `start`: data e hora de início.
- `end`: data e hora de encerramento. A duração e a contagem regressiva são calculadas automaticamente. No exemplo, são 14 dias.
- O final `-03:00` significa horário de Brasília; `Z` significa UTC. Sempre informe o fuso. O site converte para o fuso de exibição escolhido pelo jogador.
- Para cadastrar mais eventos, adicione outros objetos separados por vírgula dentro de `events`. Não use comentários nem vírgula depois do último objeto: é JSON.

### Datas diferentes por servidor

Por padrão, o evento aparece em todos os servidores com os instantes informados. Para restringir, adicione `"servers": ["America"]` ao objeto. Valores permitidos: `America`, `Europe`, `Asia`, `SEA`.

Se os horários variarem entre servidores, crie entradas com IDs distintos e o campo `servers` correspondente. Cada entrada deve usar o fuso correto das datas que você está cadastrando.

## 2. Confira e publique

Rode `npm run build` para validar nomes, datas, servidores e IDs duplicados. Depois publique o site pelo fluxo habitual do Sites — ou peça aqui: **“Publique os eventos que editei”**.

Editar o arquivo local não atualiza a versão publicada sozinho. Após a publicação, os jogadores recebem a nova agenda ao recarregar o site.

## Correções, remoções e progresso

- Editar nome ou datas mantendo o ID preserva as conclusões existentes.
- Remover o objeto da lista retira o evento da agenda. Um evento encerrado continua visível até você removê-lo.
- Reutilizar o ID de um evento antigo em uma nova edição também reutiliza sua marcação; por isso cada edição precisa de um ID novo.
- As conclusões pertencem ao navegador do jogador, são incluídas no backup e podem ser desfeitas. Não modificam o catálogo nem adicionam recompensas ao inventário.
- Eventos pessoais criados na versão anterior continuam preservados nos backups, mas não aparecem na agenda publicada.
- Atualizar o catálogo de personagens não sobrescreve este arquivo de eventos.

O arquivo é público para leitura, mas só quem tem acesso ao projeto e à publicação pode mudar a agenda distribuída. Alterações locais feitas por um jogador não alteram os eventos dos demais.
