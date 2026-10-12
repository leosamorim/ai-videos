# Sinais de fala, rosto e gesto

Os detectores ajudam o agente a localizar dúvidas e revisar bordas. A decisão continua combinando significado, fala e ação examinadas no vídeo. Uma pausa pode conter a demonstração principal; um movimento de cabeça pode fazer parte da explicação.

## Onde entram no fluxo

| Momento | Ferramenta e uso | O que decidir depois |
| --- | --- | --- |
| Análise inicial, junto da transcrição | **Silero VAD** no áudio original alinhado. `analyze` tenta executá-lo quando o extra está instalado. | Cruzar intervalos de fala provável com ASR e imagens; investigar preparação, retomadas e divergências. Não transcrever de novo só por uma divergência. |
| Dúvida localizada na atuação | **MediaPipe Face** no proxy SDR, via `inspect --face` ou `signals --face`. | Examinar o contexto das maiores mudanças de orientação e de falhas de detecção; distinguir demonstração de reset. |
| Ação com mãos difícil de localizar | **MediaPipe Pose**, explicitamente com `--pose`, nos mesmos intervalos. | Usar deslocamento dos punhos para encontrar movimento; concluir o gesto com inspeção visual. Não executar em todo vídeo por rotina. |
| Takes escolhidos, antes do corte | `signals --face --boundaries`; depois `editorial` e `cut --dry-run` consultam os relatórios existentes. | Investigar atividade vocal atravessando bordas e ausência de rosto nas amostras próximas. Ajustar apenas após examinar a evidência. |
| Corte montado e entrega | `frames --clean --cuts --context 0.5`, escuta/reprodução quando disponível, e revisão do render exato. | Conferir continuidade, sílabas, respiração, gestos e fechamento. O detector não aprova a entrega. |

O VAD entra **antes da limpeza da voz**. Mede-se o bruto, preservando a relação com transcrição e imagens. DeepFilterNet3 continua sendo tratamento separado, após seleção e antes da mixagem, conforme [AUDIO.md](AUDIO.md). Música e efeitos não entram na detecção de fala.

## Instalar uma vez

Extra local gratuito, sem serviço de inferência ou credenciais. Requer FFmpeg e **Python 3.12 com venv/pip**; Linux x86-64 é o ambiente validado. O fluxo básico Node/FFmpeg funciona sem estes extras.

```bash
# Opção leve: apenas VAD
node scripts/vid.mjs signals setup --python python3.12

# Adicionar análise de rosto
node scripts/vid.mjs signals setup --face --python python3.12

# Opcional: inclui rosto e pose
node scripts/vid.mjs signals setup --pose --python python3.12
node scripts/vid.mjs signals --status --pose
```

Se o Python não estiver no PATH, passe seu executável em `--python`. Não instalar pacotes no Python do sistema. O setup cria `.cache/vid-tools/signals/venv`, baixa apenas os modelos fixados, verifica SHA-256 e testa o carregamento com mídia sintética. Reexecutar é permitido. As versões principais e URLs/hashes estão em [models.lock.json](../scripts/analysis/models.lock.json); versões transitivas efetivamente instaladas entram na identidade do cache. Isso não é um lock completo de todas as wheels.

O setup acessa PyPI e os hosts dos modelos. A inferência é local, sem envio de gravações. `analyze`, `inspect`, `signals SLUG` e `doctor` não instalam nem atualizam pacotes/modelos. MediaPipe está fixado em **0.10.32**, que funcionou no ensaio local; outra versão testada falhou ao iniciar neste host. Não promover versões sem repetir a integração.

## Uso pelo agente

```bash
node scripts/vid.mjs analyze exemplo
# Ler 01-analysis/SIGNALS.md, a transcrição e abrir as folhas gerais.

# Investigar uma dúvida já localizada no bruto:
node scripts/vid.mjs inspect exemplo --from 8 --to 12 --every 0.1 --face

# Se o gesto exigir ajuda adicional:
node scripts/vid.mjs signals exemplo --pose --from 8 --to 12

# Após preencher edit-plan.json, revisar as bordas propostas:
node scripts/vid.mjs signals exemplo --face --boundaries --context 1
node scripts/vid.mjs editorial exemplo
node scripts/vid.mjs cut exemplo --dry-run
```

Os tempos são sempre do **bruto**. `--boundaries` reúne contextos sobrepostos das entradas/saídas de todos os keeps, incluindo abertura e encerramento, mesmo com takes reordenados. O contexto padrão de 1 s serve para inspeção; não é margem automática de corte. Para apenas medir fala: `signals exemplo`.

`analyze --signals auto` é o padrão: ausência/falha do extra produz aviso e mantém o fluxo audiovisual disponível. `--signals required` falha explicitamente quando não consegue medir; `--signals off` não executa VAD nem apaga relatórios anteriores. A etapa de evidências pode estar concluída mesmo se o extra obrigatório falhar depois: confira a saída/exit code e execute novamente. Relatórios anteriores só são consultados se a origem e integridade ainda forem válidas. `inspect --face` e `signals` explícitos falham se o extra pedido estiver indisponível; o clip de inspeção pode já ter sido produzido.

No visual, amostragem padrão **5 fps**; `signals --fps` aceita divisores de 30: 2, 3, 5, 6, 10, 15 ou 30. Cinco amostras/s localizam mudanças, mas não determinam o melhor quadro de corte. A cobertura geral e a inspeção de todas as bordas continuam obrigatórias. Aumente a inspeção onde houver dúvida, sem procurar uma face neutra ou contato visual permanente. O adaptador visual assume **um protagonista**; não resolve identidade, múltiplos falantes ou quem está oficialmente atuando.

## Relatórios, cache e relógio

- `01-analysis/signals.json`: índice com hash da fonte, caminhos e hashes dos relatórios.
- `01-analysis/signals/<hash>/report.json`: amostras completas e origem da medição. Áudio: `[tempo, probabilidade]`; vídeo: detecção, caixa/orientação e punhos opcionais. É diagnóstico, não dado de aprovação.
- `01-analysis/SIGNALS.md`: resumo para a IA, limitado aos maiores intervalos/deltas, com divergências da transcrição e avisos das bordas atuais. As listas priorizam inspeção, sem classificar intenção ou qualidade da atuação.
- `.cache/vid/v1/signals/`: inferências compartilhadas por conteúdo. Fonte, offset real, duração, proxy, janelas, fps, worker, modelos e runtime identificam o resultado. Alterar texto ou reordenar os mesmos takes não exige nova inferência; resumos são recalculados contra o texto/plano atual. Mudar as janelas recalcula o conjunto solicitado; não há cache parcial de janelas nesta versão.

O áudio é extraído novamente do bruto para o VAD, usando `ffprobe` para o offset real, inclusive em projetos antigos cujos metadados o omitam. A extração mantém exatamente a duração em amostras a 16 kHz; uma medição de energia em outro relógio não é usada. Cache válido evita também essa extração. Silero processa blocos de 512 amostras, com estado/contexto contínuos; timestamps de 32 ms indicam blocos, não precisão fonética. A histerese e o padding do resumo são **heurísticas de inspeção**, preservam atividade breve e não geram keeps/deletes.

Após mudar texto/plano, `signals SLUG` atualiza o resumo a partir do cache. `resume` confere os hashes do texto, plano e resumo antes de indicá-lo como atual; os avisos de `editorial`/`cut` são sempre recalculados nas bordas atuais.

O MediaPipe usa o proxy SDR validado do `analyze`, modo VIDEO síncrono e timestamps de quadro. O rastreamento reinicia entre intervalos descontínuos. Um JSON velho, corrompido ou incompatível é ignorado com aviso; nunca transferir conclusões entre relógios do bruto e do corte. Correções de transcrição pedem `analyze` para atualizar a associação editorial, reutilizando pixels e inferência quando iguais.

`signals` não muda `project.json`, `edit-plan.json`, EDL, palavras, evidências visuais ou aprovações. Os sinais ficam fora dos fingerprints de aprovação existentes: adicionar medições não desfaz uma entrega aprovada nem a aprova novamente. Nunca registrar estes relatórios como se fossem clips/folhas já examinados. `editorial`, `cut` e `resume` só leem medições; não iniciam inferências caras.

## Limites e validação

Os ensaios locais que motivaram a integração usaram três gravações do mesmo contexto. VAD foi barato e ajudou a distinguir parte da energia de ruído; encurtar automaticamente por VAD também retirou tempo útil de ação/fechamento. Regras fixas de ângulo marcaram fala expressiva como problema. Pose funcionou tecnicamente, mas o ganho editorial adicional não foi estabelecido. Não são métricas de precisão para outros apresentadores ou ambientes.

Por isso não há regra “sem fala → remover”, “olhou para baixo → cortar”, escore de careta ou limiar universal de velocidade. Probabilidade vocal alta não prova que o take serve ao objetivo. Falha de detecção pode ser enquadramento, oclusão ou erro do modelo. Sem aviso também não significa corte seguro. As limitações de reprodução/escuta devem constar na revisão.

```bash
npm run validate
# Integração nativa opcional após setup --pose, com mídia sintética:
VID_SIGNALS_SMOKE=1 node --test tests/signals.test.mjs
```

O teste normal não exige modelos. A integração opcional verifica modelos reais, relógio, repetibilidade, cache e imutabilidade das decisões. A CI oferece essa integração por acionamento manual; os testes não certificam naturalidade ou qualidade artística.

Referências primárias: [Silero VAD e licença MIT](https://github.com/snakers4/silero-vad), [contrato ONNX do Silero](https://github.com/snakers4/silero-vad/blob/1e261b036686cd0017d500ee96acd1c4ba572a9d/src/silero_vad/utils_vad.py), [MediaPipe Face](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker), [MediaPipe Pose](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker). Modelos e bibliotecas mantêm seus próprios termos; consulte [avisos de terceiros](../THIRD_PARTY_NOTICES.md).
