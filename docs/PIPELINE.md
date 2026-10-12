# Pipeline

## Responsabilidades

`video-edit` coordena; `video-strategy` orienta conteúdo orgânico por objetivo e público; `video-editorial` escolhe takes; `video-references` interpreta materiais; `video-visuals` planeja explicações e `video-review` avalia o render. As 14 skills técnicas do HyperFrames continuam disponíveis sob demanda. O router local e a política aplicada pelo vendoring evitam fluxos concorrentes, transcrição em inglês e atualizações globais durante a edição.

Não há um classificador fixo que deduz intenção de um rosto. O agente examina imagens/sequências, fala e contexto; a camada determinística exige decisões rastreáveis antes de executá-las. Silêncios e frases repetidas são apenas candidatos. Quando não existe reprodução contínua disponível, registrar a limitação, inspecionar a sequência densa e preservar ambiguidades.

## Artefatos

| Local no projeto | Conteúdo |
| --- | --- |
| `project.json`, `BRIEF.md` | Objetivo, formato, estado, política de revisão, hashes |
| `strategy.json` (opcional) | Direção de marketing orgânico: público, promessa, evidências, beats, CTA e métrica por destino |
| `theme.json`, `glossary.json` | Tema derivado de referências; termos e correções justificadas |
| `00-source/` | Bruto imutável e metadados, incluindo offset de áudio |
| `00-references/` | Cópias locais, manifesto de origem/papel e direction.json |
| `01-transcript/` | PCM alinhado ao vídeo, palavras originais e versão de leitura |
| `01-analysis/` | Prévia SDR, folhas gerais, clips de detalhe e evidence.json |
| `01-analysis/signals.json`, `SIGNALS.md`, `signals/` (opcionais) | Índice, resumo e medições locais de fala/rosto; não contam como inspeção realizada |
| `02-cut/` | edit-plan.json, sugestões acústicas, EDL, master e proxy, fala retimada |
| `03-plan/` | Storyboard semântico e resolved.json com tempos compilados |
| `04-composition/` | HyperFrames, mídia local (proxy/master), gráficos, legendas e tema |
| `05-renders/` | Renders numerados e entrega final |
| `06-review/` | Verificações, observações e inspeções de emendas |
| `07-versions/` (opcional) | Cópia da versão anterior inteira, feita pelo agente antes de uma mudança de direção |

Os projetos ficam locais por padrão em `.gitignore`; a ferramenta e suas skills são versionáveis. Para colaborar/versionar decisões de um projeto, escolha explicitamente quais briefings/JSON podem sair da máquina; os vídeos não precisam entrar no Git.

## Comandos

Rode a partir da raiz. `npm run vid -- ...` equivale a `node scripts/vid.mjs ...`.

| Comando | Uso |
| --- | --- |
| `welcome --json` | Detecta primeiro uso sem alterar arquivos; `--ack` registra que a orientação foi apresentada; `--preview` relê mesmo depois |
| `new SLUG --source PATH` | Cria projeto; opções `--site URL`, `--width`, `--height`, `--fps`, `--lang pt`, `--review assisted\|autonomous` |
| `reference SLUG URL_OR_FILE --role ROLE --note TEXT` | Papéis: topic, brand, editing, b-roll, constraints. Sem entrada, lista referências |
| `reference SLUG --library ID --role ROLE` | Importa referência lembrada, seu registro e hash; também aceita papéis audio, texture, font |
| `discover QUERY --kind KIND --json` | Busca local e rotas externas; `--project SLUG`, `--limit N`; sem modificar estado de projetos |
| `discover QUERY --kind KIND --online openverse\|catalog` | Busca metadados públicos com cache; `--refresh` renova; imagens/áudio no Openverse, componentes no catálogo fixado |
| `remember RECORD.json` | Registra exemplo observado/feedback local; `--replace` revisa e arquiva o anterior |
| `strategy SLUG --init` / `strategy SLUG` | Inicializa sem sobrescrever / valida estratégia orgânica; contrato e uso em [MARKETING.md](MARKETING.md) |
| `transcribe SLUG` | ASR local; `--force` arquiva e regenera; `--provider elevenlabs`, `--model`, `--engine`, `--lang`, `--keyterms` opcionais |
| `words SLUG --from N --to M` | Mostra índices/tempos; `--edited` usa a fala cortada |
| `analyze SLUG --every 2` | Prévia e cobertura geral; Silero opcional com `--signals auto\|required\|off` (padrão auto); cache por conteúdo |
| `signals setup --face --python python3.12` | Instala extras locais; sem `--face`, só Silero; `--pose` inclui gestos; `signals --status` verifica instalação |
| `signals SLUG` | Mede fala no bruto; `--face --from S --to E` mede rosto; `--pose` inclui punhos; [contrato](SIGNALS.md) |
| `signals SLUG --face --boundaries --context 1` | Mede janelas nas bordas do plano; cache, sem alterar decisões; fps padrão 5 |
| `inspect SLUG --from S --to E --every 0.25` | Clip do intervalo com áudio e sequência densa; `--face`/`--pose` adicionam sinais; tempos são do bruto |
| `editorial SLUG` | Valida o plano audiovisual sem renderizar |
| `silences SLUG` | Sugestões acústicas e alinhamento auxiliar; não substitui o plano editorial |
| `cut SLUG --dry-run` | Valida e calcula seleção sem criar arquivos de corte |
| `cut SLUG` | Executa keeps na ordem final; master na resolução da fonte + proxy leve |
| `plan SLUG --init` | Inicializa storyboard; preencher intenção e elementos |
| `plan SLUG` | Compila âncoras; rejeita palavras removidas e tempos inválidos |
| `compose SLUG --media proxy\|master` | Atualiza mídia, tema, tempos gerenciados, reframes e legendas; preserva HTML autoral. Padrão master |
| `captions SLUG` | Regenera legendas após alterações de configuração |
| `check SLUG` | Verifica atualidade dos insumos e roda HyperFrames check |
| `snapshot SLUG --at 1.5,3,7.2` | Quadros da composição atual sem renderizar, em `06-review/snapshots/`; serve para posição e legibilidade, não para movimento |
| `render SLUG --quality draft\|looks` | Render numerado, apenas após check da composição atual |
| `frames SLUG --cuts\|--cards\|--at 1,2,3` | Inspeção; `--clean` usa proxy e `--file PATH` seleciona arquivo |
| `frames SLUG --cuts --context 0.5` | Quadros consecutivos por borda, incluindo abertura e encerramento; `--boundary start\|c01\|end` limita a uma borda. Sem contexto, `--cuts` é só resumo estático |
| `frames SLUG --seq INICIO-FIM` | Quadros consecutivos do intervalo em lote (até 2000; mantenha `--step 1` para movimento); `--crop x,y,l,a` amplia uma região em qualquer modo |
| `verify SLUG --speech` | Formato/cadência/duração/áudio/defeitos; comparação ASR opcional |
| `review SLUG` | Cria review.json para o render atual |
| `review SLUG --complete` | Exige observações e verificação do mesmo arquivo |
| `gate SLUG cut\|plan\|draft --approve` | Registra aprovação humana real em modo assisted |
| `finalize SLUG` | Exige render looks atualizado/revisado; normaliza áudio e verifica entrega |
| `status SLUG` | Mostra estado e invalida derivados cujos insumos mudaram |
| `resume SLUG --chars 12000` | Resumo compacto, sem alterar arquivos; `--json` produz JSON compacto |
| `diff SLUG --from PATH --review PATH` | Compara o novo render com o anterior e identifica intervalos completos para revisão; `--motion` fornece inventário de animações |
| `frames SLUG --diff REPORT.json` | Extrai em lote todos os quadros dos intervalos indicados pelo diff correspondente ao render atual |

`stage` serve para registrar etapas auxiliares; não substitui os validadores. Em assisted, marque o storyboard para revisão junto da prévia se essa for a preferência do usuário; em autonomous, `finishStage` completa sem pedir nova autorização. `compose --force` reconstrói o HTML e só deve ser usado quando essa substituição for desejada. `cut --legacy` é uma opção explícita de compatibilidade para cuts.json e não faz julgamento visual.

## Orientação de primeiro uso

O agente segue `AGENTS.md`: consulta `welcome --json` antes de iniciar a primeira tarefa de vídeo ou orientar alguém a começar. `should_show` só é verdadeiro se não existir `videos/*/project.json` nem registro prévio da apresentação. Pastas vazias não contam como projetos; um manifesto existente conta mesmo se estiver incompleto, sem ser carregado ou migrado.

A mensagem vem de `templates/WELCOME.md`. O agente a apresenta brevemente na conversa, adapta ao idioma do usuário e só então executa `welcome --ack`. Esse comando grava `.local/welcome.json`, excluído do Git e da distribuição pública. Consultar o comando ou usar `--preview` não grava nada. Pedidos somente de análise não gravam o registro; nesses casos, evitar repetição na própria conversa. Manutenção do repo e testes não acionam a apresentação. Não há nova aprovação nem mudança automática de modelo.

## Seleção audiovisual

`analyze` inicializa um plano incompleto, que o agente preenche depois de examinar evidências. Exemplo de um bruto hipotético de 10 segundos:

```json
{
  "schema": 2,
  "source_signature": "copiar de evidence.json",
  "reviewer": "agente que realizou a inspeção",
  "intent": "explicar uma solução espacial",
  "review": {
    "transcript_reviewed": true,
    "visual_reviewed": true,
    "visual_method": "frames",
    "uncertainties": [],
    "observations": [
      {"evidence_id": "overview-1", "observation": "Descrever o que foi efetivamente examinado e por qual método."},
      {"evidence_id": "detail-0-1000", "observation": "Sequência mostra preparação antes da primeira fala; indicar limitação se não houve playback."}
    ]
  },
  "segments": [
    {"id": "explanation", "start": 1, "end": 10, "role": "explanation", "take_id": "take-2", "reason": "Frase completa com gesto útil.", "evidence_ids": ["overview-1"]}
  ],
  "discarded": [
    {"id": "setup", "start": 0, "end": 1, "kind": "setup", "reason": "Preparação antes da atuação.", "evidence_ids": ["detail-0-1000"]}
  ],
  "protected": []
}
```

`segments` fica na ordem desejada de saída, permitindo trazer uma fala posterior para a abertura. `discarded` e keeps cobrem o bruto inteiro; não podem se contradizer. Proteções usam `{start,end,reason}`. Descartes de `setup`, `off-performance`, `retake` ou `post-roll` exigem clip de detalhe cobrindo o intervalo. Não use categorias genéricas para contornar a revisão. Bordas que cortam palavras são rejeitadas; corrija alinhamento a partir do áudio quando necessário.

Todo tempo de entrada se refere ao primeiro quadro do vídeo original. A extração insere/remove a diferença de início do áudio antes do ASR. EDL usa limites de quadro inteiros com fim exclusivo; os cortes de áudio usam amostras equivalentes. `source_i` e `segment_id` preservam a origem de cada palavra após reordenação.

Depois da seleção, seguir [CUTTING.md](CUTTING.md) para refinar fala, ação, pausas e ruídos. `cut` gera um roteiro por borda em `02-cut/CUT-REVIEW.md`, que o agente completa após inspecionar. `frames --cuts` usa índices exatos da EDL; `--context` expande a inspeção sem alterar o corte e `--boundary` permite trabalho localizado. A revisão final registra essas observações em `checks.seams.notes` do render exato. Não há novo schema nem classificação automática de expressões.

Quando a fala precisar de limpeza, seguir [AUDIO.md](AUDIO.md): DeepFilterNet3 é a preferência inicial, com preservação do relógio e comparação auditiva. É um pré-processamento opcional do agente, sem comando `vid denoise`. A voz tratada entra como asset/faixa separada na composição; não sobrescrever master/proxy nem contornar seus hashes. Música/SFX são misturados depois, e o render resultante requer revisão atualizada.

## Referências e tema

Consulta autônoma, fontes por finalidade, memória de preferências e acessos disponíveis: [library/SOURCES.md](../library/SOURCES.md). `library/sources.json` é o catálogo versionável; `library/references/*.json` e `.cache/reference-discovery/` ficam privados por padrão. Descoberta e memória não invalidam projetos; importar uma referência selecionada segue a invalidação normal. Uma falha de API fica explícita, com eventual cache antigo identificado.

O manifesto registra origem, papel, captura, hash e observações. HTML é transformado em texto/metadados sem executar scripts nem seguir recursivamente links. PDFs são preservados e recebem texto quando pdftotext está disponível; imagens, vídeo e demais arquivos são copiados para exame pelo agente. Sites dinâmicos podem precisar de browser/screenshot: texto extraído não comprova aparência.

Papéis `audio`, `texture` e `font` permitem catalogar assets de apoio com a mesma proveniência. MIME conhecido mantém a extensão de mídia adequada; captura remota aceita `--max-mb` de 1 a 256 (padrão 8). Licenças/atribuições devem acompanhar o item adotado, sem presumir direitos pelo fato de um download ser possível. `reference --library` copia a análise de origem e detecta mudança no arquivo desde a inspeção.

`direction.json` reúne escolhas e suas referências; `theme.json` controla paleta, fonte local, margens proporcionais e legendas. O agente ajusta o tema com base nos materiais examinados. Não há promessa de reproduzir automaticamente uma marca extraindo cores de CSS. Prefira material real do projeto para exemplos factuais; identifique ilustrações conceituais.

### Estilo das legendas

`theme.captions` (ou `04-composition/captions.config.json`, que tem precedência) aceita, além de fonte, tamanho e cores:

| Opção | Efeito |
| --- | --- |
| `plate` | `{color, radius, paddingX, paddingY, shadow}`: placa atrás do texto. Use quando o fundo do vídeo é claro ou varia muito |
| `singleLine` | um bloco por linha, para a placa abraçar o texto; ajuste `maxChars` junto (25 a 58 px de fonte em 1080 de largura) |
| `upcomingOpacity` | menor que 1 deixa mais claras as palavras ainda não ditas; cada uma escurece no instante em que é falada |
| `rise` | o bloco entra subindo alguns pixels |
| `fontFaceWeight` | faixa de pesos quando o arquivo da fonte é variável, por exemplo `"100 900"` |
| `outlineWidth: 0` | desliga o contorno |
| `emphasisStyle` | `{fontFamily, fontFile, fontStyle, fontWeight, scale}`: as palavras de `emphasis` usam outra fonte e tamanho (ex.: itálico serifado 30% maior), com `highlightMode: "selected"` |
| `textShadow` | sombra CSS completa para legenda sem placa; substitui o contorno |
| `underline`, `underlineStyle` | palavras (mesmas referências de `emphasis`) que recebem um traço de marcador riscado no instante em que são ditas; estilo `{color, thickness, duration}`. Poucas por vídeo |
| `entrance` | `"role"`: bloco que contém palavra de `emphasis` estala, os demais sobem de leve; sem o campo valem `pop`/`rise` |
| `phraseStarts` | lista de `source_i` ou `{source_i, segment_id}` para quebras editoriais persistentes; falha se a palavra desaparecer ou ficar ambígua |
| `highlightMode` | `word` (compatível com o estilo anterior), `selected` (acentos estáticos escolhidos) ou `none` |
| `emphasis` | referências de palavras da fonte que recebem acento em modo `selected` |
| `breakOnPunctuation` | `clause` (padrão), `sentence` ou `none`; permite manter listas juntas |

`compose` e `captions` geram `06-review/captions.json`, um relatório consultivo de duração/velocidade por bloco. Referências usam a palavra original, não a posição no corte. Consulte [CRAFT.md](CRAFT.md) para critérios de leitura/continuidade e [EFFICIENCY.md](EFFICIENCY.md) para reaproveitar artefatos sem transferir aprovação.


A quebra dos blocos evita terminar em palavra de ligação ("os meus projetos" / "de área de serviço"). `theme.fontFamily` e a fonte das legendas usam Inter por padrão; famílias adicionais precisam estar em `brand/fonts/fonts.json`. Temas já usados para uma marca ficam em `brand/theme.<marca>*.json` como pontos de partida, não como padrão do workspace: leia o pedido atual e o [guia de marcas locais](BRANDS.md) antes de copiar um para `videos/<slug>/theme.json`.

## Storyboard e composição

Com `strategy.json`, acrescente `beats` temporizados com os mesmos IDs da estratégia; cards e reframes recebem `beat_id` válido. `plan` exige a correspondência e sobreposição temporal. Beats podem ser só fala/ação sem efeito e não impõem ordem/duração. A [direção de marketing](MARKETING.md) detalha o formato, a revisão estratégica e o aprendizado posterior.

```json
{
  "schema": 1,
  "intent": "mostrar como o armário estreito organiza os objetos",
  "cards": [{
    "id": "cabinet-width",
    "purpose": "tornar a largura compreensível",
    "anchor": {"source_word": 42, "segment_id": "explanation", "duration": 2},
    "visual": "Desenho conceitual; a medida só entra depois de conferida."
  }],
  "reframes": [{
    "id": "closer",
    "purpose": "aproximar a apresentadora sem perder o gesto",
    "anchor": {"source_word": 50, "duration": 3},
    "scale": 1.12, "x": 0, "y": -30, "transition": 0.25
  }],
  "caption_zones": [],
  "intentional_holds": []
}
```

O agente implementa o desenho em HTML/SVG/GSAP, com IDs correspondentes. O compilador sincroniza âncoras, reframe e zonas; não inventa um gráfico a partir do campo `visual`. Use `window.editorialTimeline.cards` para os tempos das animações internas. Evite números duplicados em código manual. `compose` atualiza duração dos elementos gerenciados; animações antigas com tempos fixos precisam ser revistas. Reenquadramentos gerados não devem receber um segundo controlador manual. Técnicas já conferidas em render (montagem por script, movimento sobre a fala, traço que se desenha, vídeo de apoio, textura, efeitos sonoros) e as armadilhas de cada uma: [COMPOSITION.md](COMPOSITION.md).

`caption_zones`: objetos com id, purpose, anchor (ou start/end), e `y` ou `hidden:true`. Elas dividem um bloco de legenda quando a mudança cai no meio dele. `intentional_holds`: intervalos `{start,end,reason}` para contextualizar congelamentos intencionais na revisão.

## Cache, invalidação e migração

Hashes vinculam os artefatos e a revisão aos insumos. Fonte/transcrição alterada invalida análise e corte; mudanças de corte invalidam storyboard, composição e entrega; referências/tema invalidam as etapas pertinentes. Os arquivos antigos permanecem disponíveis, mas suas aprovações deixam de valer. Renders e inspeções são numerados/preservados.

Adicionar, mudar ou remover `strategy.json` invalida `plan` e seus derivados, sem descartar ASR/análise/corte já disponíveis. O agente reavalia a seleção se o objetivo mudar. Projetos sem esse arquivo mantêm seus hashes anteriores. Resultados posteriores em `06-review/learning.md` não entram no fingerprint de produção; registrar uma métrica não invalida a entrega.

Projetos antigos ganham pastas de análise/referência ao carregar. Transcrições anteriores sem `timeline: source-video` devem ser regeneradas com `transcribe --force`; o original é arquivado. Não basta acrescentar o campo manualmente se o áudio estava em outro relógio. Refaça analyze, seleção, cut, plan e compose para migrar ao master em alta resolução. Reutilize decisões antigas após revisá-las, sem descartar trabalho autoral.

## Iteração e distribuição

`check`/`render` resumem a saída e gravam logs em `06-review/`; use `--verbose` para diagnóstico. O cache é local e não contém aprovações. Regras de invalidação, revisão incremental e proxy estão em [EFFICIENCY.md](EFFICIENCY.md). Compatibilidade: [MIGRATION.md](MIGRATION.md). A preparação pública passa por `npm run release:check` e `npm run release:export`; consulte [PRIVACY.md](PRIVACY.md).
