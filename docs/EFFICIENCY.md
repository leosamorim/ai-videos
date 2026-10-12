# Iteração econômica com revisão preservada

O objetivo é reduzir trabalho repetido, saídas extensas e contexto carregado em sessões de assinatura. Não há conversão garantida de tokens economizados em mensagens disponíveis: cada serviço aplica seus próprios limites.

| Prioridade | Mecanismo | O que permanece obrigatório |
| --- | --- | --- |
| 1 | `vid resume`, transcrição compacta e skills sob demanda | Decisões completas em arquivos; cobertura integral do bruto na primeira seleção |
| 2 | Cache de ASR, overview, detalhes e mídia do corte por conteúdo | Reavaliar significado após mudança de fala/briefing; cache não é aprovação |
| 3 | `compose --media proxy` e render draft | Mesmos fps, quadros, duração e canvas; entregar e revisar o master |
| 4 | `vid diff` e sequências em lote | Comparação integral, animações completas, bordas e verificação do render atual |
| 5 | Primitivas locais e logs de check/render em arquivo | Adaptar direção ao conteúdo e conferir movimento no render |

## Reaproveitamento

`.cache/vid/v1/` guarda artefatos locais compartilhados entre projetos. As chaves incluem hashes dos insumos, parâmetros, revisão do produtor e versões das ferramentas. Todo arquivo do cache tem hash conferido antes da reutilização. Entrada ausente ou corrompida é recalculada. A pasta pode ser apagada quando nenhum comando estiver rodando; isso perde economia, não decisões dos projetos. Não há limpeza automática por tamanho nesta versão.

- **ASR:** identidade do PCM alinhado, duração, provedor, idioma, engine, modelo e termos efetivamente enviados. Só o resultado original entra no cache; correções do projeto não contaminam outros projetos. `transcribe --force` ignora e renova o cache desse insumo, preservando a transcrição anterior no projeto.
- **Análise:** imagens dependem do vídeo e da amostragem. O `source_signature` editorial continua dependendo também da transcrição. Uma correção pode reutilizar os mesmos pixels, mas não silenciosamente validar o plano antigo. Detalhes conservam hashes do clip e das folhas.
- **Corte:** vídeo bruto, filtro efetivamente compilado, fps, CRF e versões. Se apenas o texto mudar e os intervalos permanecerem iguais, master/proxy são reaproveitados; fala retimada e âncoras são recalculadas. `cut --force` regenera a mídia.
- **Verificação de fala:** ASR pode ser reaproveitado quando o áudio é idêntico. A comparação contra as palavras esperadas é sempre recalculada.

O grafo de invalidação de revisões continua conservador, compatível com projetos existentes. O reaproveitamento ocorre na produção dos artefatos caros; não remove gates nem presume que uma correção seja apenas ortográfica. Cache de provedor remoto não impede mudanças futuras do modelo do serviço; use `--force` quando quiser uma nova inferência.

## Revisão incremental

Depois de uma mudança localizada, mantenha o render e a revisão anteriores e gere o novo render:

```bash
node scripts/vid.mjs diff exemplo \
  --from videos/exemplo/05-renders/draft-01.mp4 \
  --review videos/exemplo/06-review/review-anterior.json
node scripts/vid.mjs frames exemplo --diff videos/exemplo/06-review/diff-HASH-HASH.json
```

Use o caminho real retornado pelo primeiro comando. `--to` permite escolher o novo arquivo. `--motion` informa um mapa alternativo; por padrão é `04-composition/motion-plan.json`:

```json
{"motions":[{"id":"cta-click","start":42.1,"end":43.3}]}
```

Inclua toda animação autoral, entrada/saída de legenda, transição e movimento contínuo. O diff compara hashes de **todos os quadros decodificados, em resolução integral**, seus tempos/formato/cor e o áudio PCM em taxa/canais nativos. Não usa similaridade perceptual. Incompatibilidade de timeline obriga revisão visual integral. Frames alterados são expandidos por bordas (padrão dois quadros) e pela duração completa das animações intersectadas, inclusive sobreposições.

O relatório só declara elegibilidade para reaproveitar observações quando encontra uma revisão completa do arquivo anterior, mesma estratégia e timeline compatível. O operador registra quais folhas anteriores realmente examinou, quais quadros são iguais e quais folhas novas abriu. A completude do mapa e a validade artística das observações continuam sendo julgamento editorial. O CLI não preenche `ok` nem conclui a revisão automaticamente. Áudio alterado precisa de nova escuta; ASR/medidas não demonstram naturalidade.

Sem revisão anterior válida ou sem inventário completo das animações, faça a revisão normal. Aprovar um proxy não aprova o master: encoders, nitidez e pequenos elementos podem mudar.

## Controle de contexto e render

`check` e `render` salvam logs completos em `06-review/` e imprimem resumo; `--verbose` mostra a saída integral. `frames` extrai quadros selecionados em lote, usa PTS para pedidos por tempo e reutiliza folhas intactas. `--crop` permite conferir detalhes sem abrir folhas gigantes.

Use uma sessão por projeto ou revisão delimitada, com decisões salvas antes de encerrar. Não imponha número máximo de renders se houver defeito conhecido. Modelos de visão locais, outro provedor multimodal, separação automática de atuação e render parcial continuam opções de pesquisa: não são dependências nem substitutos implantados para o julgamento audiovisual.

## Medir o ganho

Compare a mesma tarefa com os mesmos insumos: tempo até a prévia, chamadas de ASR, acertos de cache, renders e folhas novas efetivamente abertas. Registre também defeitos encontrados. Os testes provam reutilização/invalidação e fidelidade mecânica em fontes sintéticas; não estabelecem um percentual universal de economia ou qualidade artística.
