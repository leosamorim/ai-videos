# Direção, coreografia e verificação

Consulte este guia quando houver motion, uma explicação gráfica ou disputa de atenção. Ele complementa [CRAFT](CRAFT.md) e o storyboard existente. Os campos novos são opcionais; uma correção de legenda ou um trecho que já funciona não exige refazer a direção.

## Escolher o que conduz cada beat

| Modo | O que conduz | Decisão antes de animar |
| --- | --- | --- |
| `performance` | Fala, expressão, gesto ou objeto real | O que precisa continuar visível e audível? O movimento da própria pessoa pode bastar. |
| `explanation` | Relação, comparação, detalhe ou processo | Qual informação deve ser percebida primeiro? Qual estado precisa permanecer para a comparação? |
| `motion` | Transformação visual, conceito ou estrutura musical | Qual mudança comunica a ideia? Onde a ação termina e dá tempo para compreendê-la? |

Os modos podem coexistir na mesma peça. As cotas dos guias técnicos — dois focos, três camadas, novidade a cada poucos segundos, animar todas as imagens — não são requisitos editoriais deste repo. Um foco dominante e uma imagem estável podem ser a direção correta. Varie a função quando o conteúdo muda; mantenha a linguagem dos elementos de mesma função.

Listas genéricas de fontes/estilos banidos também não substituem a marca e a legibilidade. As fontes locais do projeto, inclusive Inter, são opções válidas. Buscar uma nova família só quando houver ganho concreto, com licença e incorporação local conferidas.

Para um beat complexo, acrescente `direction` ao item do storyboard:

```json
{
  "mode": "explanation",
  "focus": "o detalhe que muda o resultado",
  "takeaway": "entender por que a segunda opção resolve o problema",
  "order": ["localizar o objeto", "isolar o detalhe", "comparar", "voltar à pessoa"]
}
```

`mode`, `focus` e `takeaway` são obrigatórios somente quando `direction` é usado. `order` é opcional. Isso descreve atenção, sem gerar uma cena automaticamente. O modo não escolhe paleta, engine ou estilo por você.

## Três estruturas adaptáveis

- **Localizar um detalhe:** mostrar o contexto, reduzir a competição ao redor, revelar a anotação, sustentar a explicação e retornar. Objeto, contorno e rótulo acompanham o mesmo wrapper/câmera. Não usar cota sem fonte nem escurecer tudo por hábito.
- **Comparação persistente:** manter a primeira opção enquanto a segunda entra na sua menção; preservar escala, posição e rótulos para comparar. A conclusão vem depois da evidência. Evitar fazer o espectador reconstruir de memória uma opção que desapareceu.
- **Processo progressivo:** partir de um estado, mostrar uma transformação e manter suas consequências na próxima etapa. Reutilizar os objetos para mostrar continuidade; explicitar a mudança relevante, sem reconstruir um card para cada frase.

São sequências de compreensão, sem layout ou efeito obrigatório. Procure exemplos da função em `vid discover`, inspecione um pequeno conjunto e registre o que adaptar. Um índice de vídeos ou uma demo bem apresentada não prova qualidade do código nem direitos sobre os assets.

## Um evento para imagem e som

`events` e `sound_cues` são campos opcionais de `03-plan/storyboard.json`. `plan` resolve os tempos; `compose` publica os mesmos eventos em `window.editorialTimeline.events` e escreve os `<audio>` em um bloco gerenciado. Não há segunda timeline de som.

Exemplo: um card de 3 s e o contato do cursor, relativo ao card. Em fala editada, prefira um card ancorado por `source_word` e `segment_id`; os segundos explícitos abaixo servem para uma cena independente.

```json
{
  "schema": 1,
  "intent": "explicar a próxima ação sem disputar atenção com a fala",
  "cards": [{
    "id": "follow", "purpose": "apresentar o convite", "start": 5, "end": 8,
    "reads": [{"id": "label", "text": "Acompanhe os próximos exemplos",
      "from": 0.3, "to": 2.8, "min_hold": 1.5, "max_cps": 18}]
  }],
  "events": [{"id": "follow-hit", "purpose": "contato visível do cursor",
    "at": {"item_id": "follow", "offset": 1.2}}],
  "sound_cues": [{"id": "follow-click", "event_id": "follow-hit",
    "asset": "assets/sfx/click.wav", "attack": 0.04, "duration": 0.2, "volume": 0.2}]
}
```

Na composição, use o evento também para a ação visual:

```js
const hit = window.editorialTimeline.events.find(e => e.id === 'follow-hit').time;
const motion = VidMotion.click(tl, {
  button: '#follow-button', cursor: '#cursor',
  label: '#follow-label', doneLabel: '#following-label'
}, {id: 'follow-click-motion', hit, duration: 0.8});
// motion.start/end e motion.markers servem ao inventário de revisão.
```

O helper calcula sua entrada a partir de `hit`; alterar sua duração preserva o instante de contato. Para animação própria, use o mesmo `event.time` no GSAP. A implementação manual ainda precisa mostrar a ação naquele instante: JSON consistente não comprova sincronia perceptiva.

Cada evento aceita **exatamente um** relógio: `at: {item_id, offset}` dentro de um beat/card/reframe/zona; `anchor: {source_word, segment_id, offset}` para o início de uma palavra; ou `time` em segundos editados. Eventos não referenciam outros eventos. IDs desconhecidos, repetidos, âncoras ambíguas e tempos fora da timeline falham cedo.

O som começa em `event.time + offset - attack`. `offset` é opcional, em segundos, para antecipação/atraso intencional; documente o motivo no cue. `attack`, `duration` e `volume` são explícitos: o ataque é medido a partir do início do **arquivo final**, já aparado e com a altura/velocidade desejada. O sistema não detecta o ataque nem faz retime. Não alinhe pelo começo de um arquivo com silêncio. Limites inválidos não são corrigidos truncando o som.

Coloque o asset licenciado em `04-composition/assets/` antes de `compose` (ou em `brand/sfx/` quando compartilhado localmente). Use nomes simples, relativos, sem espaços. `compose/check` conferem existência, duração de áudio e confinamento local; `check` registra hash, evento e ataque em `06-review/choreography.json`. Direitos e escuta continuam registrados no ledger/revisão do projeto. Depois de trocar os bytes do som, meça seu ataque outra vez. Nível linear não determina qualidade de mix: ajuste com a voz presente.

O bloco `EVENT-SOUNDS` pertence a `compose`; editar manualmente seus tempos causa erro em `check`. Sons autorais fora dele permanecem intactos. Ao migrar um efeito existente para `sound_cues`, retire seu `<audio>` antigo para não duplicá-lo. `compose` não sintetiza música, não baixa mídia e não sonoriza todos os cortes.

## Tempo útil de leitura

O campo `reads` de um item descreve estados distintos do texto. `from` e `to` são offsets dentro do item, entre o texto ficar **completo, estável e legível** e deixar essa condição. Exclua entrada, revelação letra a letra, borrão, oscilação relevante, saída e oclusão. Se o texto mudar, declare outra janela com outro `id`, sem somar intervalos descontínuos como uma leitura contínua.

`plan` escreve `03-plan/reading.json`; `check` atualiza `06-review/choreography.json` com a assinatura da composição. Os relatórios calculam duração e caracteres/s. `min_hold` e `max_cps` são metas opcionais definidas para aquele texto/público, não normas universais. Sem metas, exibem medidas; sem janelas, indicam `not-checked`. Cards sem declaração aparecem em `unchecked_cards` e podem ser apenas imagem. Nenhum caso recebe aprovação automática.

Esses dados são declarados, não medidos nos pixels. Depois de carregar as fontes locais (`document.fonts.ready`), medir texto com fonte/peso/espaçamento reais quando houver ajuste programático; reutilizar medidas para a mesma configuração. Conferir no quadro em escala de celular: tamanho, contraste, linhas, oclusão, legendas e elementos simultâneos. Uma animação/texto alterado exige revisar a janela e observar o novo render; o hash detecta alteração, mas não corrige a declaração. A legenda mantém sua auditoria específica em `captions.json`.

## Implementar e revisar com menos retrabalho

1. **Antes do acabamento:** resolver ordem de atenção e estados-chave. Se uma técnica incerta sustenta o conceito, testar um pequeno trecho representativo em composição sintética/local antes de espalhá-la. Não é etapa obrigatória para um efeito já verificado.
2. **Construir pelo relógio:** usar a timeline pausada do HyperFrames; estados derivados do tempo, sem timers, callbacks acumulativos ou aleatoriedade global. Se houver textura/boil, seed estável por objeto; pré-calcular textura estática uma vez. Não introduzir `window.seek` paralelo: preservar o contrato da versão fixada.
3. **Conferir estados:** testar a abertura, o frame anterior/posterior às mudanças e o fim. Testar seek direto, para trás e em ordem não cronológica, comparando com uma página nova. Nenhum texto crítico deve depender de uma animação anterior ter sido reproduzida.
4. **Revisar o artefato:** snapshots verificam layout. Movimento exige playback ou sequências consecutivas do render exato, conforme `video-review`. Conferir ataque sonoro com a imagem e escuta, sem confundir medição com audição. Contact sheets espaçadas não aprovam movimento ou som.
5. **Corrigir o problema concreto:** registrar intervalo → observação → alteração → evidência de verificação. Priorizar significado/atuação/leitura/sincronia antes de polimento. Repetir o que a mudança afetou; usar `vid diff` quando houver base válida. Não perseguir nota subjetiva 8+, número fixo de rodadas, partículas, springs ou supersampling em todos os vídeos.

## Origem e seleção

Síntese consultada em 2026-10-13; implementação local original, sem importar engines ou assets dos exemplos.

| Material | Princípio incorporado | Limite da aplicação |
| --- | --- | --- |
| [Motion Design Studio — Movez](https://movez.substack.com/p/how-to-build-motion-design-studio) | Direção explícita, estados determinísticos e iteração sobre evidências | Novidade periódica, música sintetizada por padrão e notas autoatribuídas não viram gates |
| [ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase/blob/main/ANIMATION_GUIDE.md) | Ordenar atenção e dar tempo para compreender o resultado da ação | Regras de cartoon e animação constante não se aplicam à atuação |
| [claude-animation-skill](https://github.com/buildwithhanif/claude-animation-skill) | Movimento reproduzível, textura controlada e estabilidade entre seeks | O próprio pacote exclui edição de talking-head; não instalar outro renderizador |
| [PDoomVideo](https://github.com/JohnHeibel/PDoomVideo) e [Battle of Austerlitz](https://github.com/WinterArc21/Battle-of-Austerlitz-Film) | Estados persistentes, câmera compartilhada e eventos visuais/sonoros ligados | Sem licença identificada na revisão: estudar o mecanismo, sem copiar código/assets |
| [Lemo Opuscar](https://github.com/lemomo-ai/lemo-opuscar) | Separar direção/técnica/estilo; janelas de leitura e eventos compartilhados | O readcheck depende de declarações e não detecta oclusão; cotas do diretor não são universais |
| [awesome-ai-motion](https://github.com/guanmo-ai/awesome-ai-motion) | Descoberta de referências de motion por metadados | Exclui protagonistas reais; não é curadoria de cortes de fala nem aprovação dos direitos |
| [awesome-claude-5-5-videos](https://github.com/athemeroy/awesome-claude-5-5-videos) | Escolher técnica pelo resultado e testar o trecho de maior risco | Demos e relatos não são benchmarks controlados de qualidade/custo |
| [Remotion skills](https://github.com/remotion-dev/skills) | Medir tipografia com fontes carregadas e tratar duração/overlap explicitamente | Conhecimento transferível, sem adicionar Remotion ao fluxo HyperFrames |
