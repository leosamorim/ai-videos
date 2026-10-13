# Limpeza de fala e preservação da voz

Quando houver ruído que prejudique a fala, **DeepFilterNet3 é a primeira opção de limpeza local deste repo**. O perfil abaixo oferece um ponto de partida reproduzível, sujeito a comparação com o original em cada projeto. Priorize naturalidade, inteligibilidade e integridade das palavras; diferenças de poucos segundos de processamento têm peso secundário.

É um ponto de partida para novas edições, não uma afirmação de superioridade em toda gravação. Mantenha o original se a limpeza não ajudar. Respeite outra escolha explícita do usuário. Uma preferência anterior não aprova automaticamente o áudio de outro projeto.

## Decisão e perfil inicial

| Situação | Direção |
| --- | --- |
| Fala com ruído de fundo perceptível | Começar por DeepFilterNet3, redução moderada; comparar com o original em volume equivalente |
| Voz já limpa ou tratamento com timbre metálico/abafado | Manter o original ou reduzir a intensidade |
| DeepFilterNet3 deixa um problema relevante | Comparar DPDFNet 48 kHz como alternativa; maior redução de fundo não garante voz mais natural |
| Recursos muito limitados ou correção discreta | Considerar RNNoise/FFmpeg, verificando consoantes, números e terminações |
| Silêncio expressivo, respiração ou som de demonstração | Preservar a função editorial; aplicar [CUTTING.md](CUTTING.md), sem gate ou corte indiscriminado |

Perfil inicial validado: **DeepFilterNet3, PCM 48 kHz, limite de atenuação de 12 dB, compensação de atraso, sem pós-filtro agressivo**. São parâmetros iniciais, não uma meta obrigatória de redução. No executável nativo, `-a 12` limita a atenuação pela mistura com o sinal original; não é ganho de saída. Os flags e sua semântica variam entre ferramentas.

## Fluxo recomendado

1. Preserve o bruto e a transcrição original. Selecione os takes com a evidência audiovisual já disponível; limpeza não decide cortes nem exige refazer o ASR de intake.
2. Para uma nova edição, extraia somente os intervalos usados com contexto de cada lado. **0,5 s antes/depois** funcionou no teste local; adapte ao ruído, ao modelo e aos limites da fonte. As margens alimentam o processador e são removidas depois, sem entrar na EDL ou deslocar palavras.
3. Trate a voz isolada. Recorte o resultado nos mesmos limites de amostras e aplique os fades de emenda uma única vez. Em uma montagem já fechada, tratar a voz montada também é válido; confira principalmente inícios, fins e mudanças de ambiente.
4. Compare original/tratado com ganho constante para volume equivalente e folga de pico. Aumentar volume pode mascarar uma piora de timbre. Preserve o controle sem limpeza para reverter a escolha.
5. Adicione música e SFX depois da limpeza. Confira equilíbrio e faça a masterização final pelo fluxo normal. Não passe o mix completo pelo denoiser nem empilhe modelos de limpeza por padrão.

Tratar os trechos selecionados reduz o volume processado quando o corte usa apenas parte do bruto. Se muitos vídeos reutilizam quase toda a fonte, considere um derivado integral em cache. Avalie por projeto; não prometa um percentual universal de economia.

## Execução local e relógio

A limpeza é um pré-processamento opcional conduzido pelo agente. **Ainda não existe comando `vid denoise` nem instalação automática do modelo.** Consulte primeiro o ambiente e reutilize ferramentas/modelos disponíveis. Se faltarem, use uma instalação local isolada, dentro da tarefa autorizada; registre versão, origem e hashes. Não troque o engine de edição nem atualize dependências globais.

Referência reproduzível do teste: executável nativo DeepFilterNet **0.5.6** para Linux x86-64 e modelo **DeepFilterNet3** explícito. O nome do pacote/executável não basta para identificar o modelo. Não é uma indicação de versão mais recente.

- [Executável testado](https://github.com/Rikorose/DeepFilterNet/releases/download/v0.5.6/deep-filter-0.5.6-x86_64-unknown-linux-musl), SHA-256 `70775e251eee44c0f2451a1e833326cf8bcbbe304d3e7cd12851e6fce72ef7da`.
- [Modelo testado, ref fixado](https://raw.githubusercontent.com/Rikorose/DeepFilterNet/978576a/models/DeepFilterNet3_onnx.tar.gz), SHA-256 `c94d91f70911001c946e0fabb4aa9adc37045f45a03b56008cb0c8244cb63616`.
- [Documentação e licenças oficiais](https://github.com/Rikorose/DeepFilterNet). Binários e pesos não fazem parte da distribuição deste repo. Para outro sistema/arquitetura, use o artefato compatível e valide novamente o comportamento.

Com os caminhos locais resolvidos, a chamada de referência é:

```bash
deep-filter -m /caminho/DeepFilterNet3_onnx.tar.gz \
  -D -a 12 -o /caminho/saidas /caminho/voz-com-margem-tecnica.wav
```

Esse comando é apenas a inferência. A preparação e a conferência precisam garantir:

- Tempo zero igual ao primeiro quadro da fonte, com offset original de áudio aplicado **uma única vez**. Para áudio já alinhado do corte, não reaplicar o offset do bruto.
- Taxa/canais explícitos. O teste comparou a mesma redução mono L/R em todas as versões; isso não autoriza colapsar estéreo em qualquer gravação. Considere microfones separados, fase, falantes e som espacial antes de decidir.
- Com `-D`, o binário testado alinhou a fala mas encurtou a saída em **1.440 amostras a 48 kHz (30 ms)**. Acrescente uma margem técnica de silêncio **antes** da inferência (100 ms foi suficiente neste perfil), depois remova somente o excedente para recuperar o comprimento exato. Não complete com zeros uma fala cujo fim já foi perdido. Essa margem técnica é adicional ao contexto de fonte.
- Confira comprimento em amostras, atraso residual e início/fim reais. Duração de contêiner ou flags do modelo não comprovam sincronismo. Meça atraso em várias regiões de fala e confirme as emendas; não transforme uma medida desta versão em constante para todos os backends.
- Preserve `source_i`, `segment_id`, ordem da EDL, fps e duração. Limpeza não muda velocidade, pitch ou relógio das legendas.

## Conectar ao mecanismo existente

`compose` copia a mídia original do corte para `04-composition/assets/clean.mp4`, e o pipeline confere esse hash contra master/proxy. **Não sobrescreva esse arquivo, o master do corte ou os hashes para encaixar a limpeza.**

Guarde a voz tratada, já no relógio editado, como asset próprio, por exemplo `04-composition/assets/audio/voice-clean.wav`. Na composição, silencie a voz embutida no vídeo com `data-volume="0"` e use um único elemento `<audio>` para a nova voz, com início zero e duração exata da edição. Mantenha o vídeo e seus movimentos. Use `hyperframes-audio`/`hyperframes-core` para os atributos; não deixe as duas vozes tocando juntas. Conserve os SFX/música em suas próprias faixas.

Depois de `compose --media master`, confirme que a faixa substituta continua ligada e corresponde à EDL atual. `compose --force` recria o HTML: se necessário, reaplique a ligação e confira novamente. Alterações no asset/composição entram na assinatura do render; rode `check`, renderize e revise o arquivo atual antes de finalizar. Não substitua o áudio de um final já aprovado sem nova revisão correspondente.

## Evidência, cache e revisão

Registre no projeto a origem do áudio, relógio, intervalos/margens, taxa/canais, modelo/versão/hash, parâmetros, compensação de atraso, saída e motivo da escolha. Identifique separadamente medições, julgamento do agente e preferência explícita do usuário. Esses registros, gravações e comparações ficam locais; o guia público não inclui os projetos de teste.

Para um cache de limpeza, inclua identidade do PCM, taxa/canais, intervalos, margens, modelo, parâmetros e versão do processador. O cache geral do repo ainda não gerencia esse tratamento automaticamente. Alguns WAV incluem metadados voláteis: a identidade do PCM deve vir das amostras decodificadas e de seu formato, sem ignorar canais/relógio. Reuso de áudio não transfere aprovação para um render modificado.

Na revisão:

- Compare em volume equivalente a abertura, voz baixa, números/nomes, sibilantes, respirações, bordas de cortes e CTA. Procure timbre metálico, perda de corpo, oscilação de fundo e palavras truncadas.
- Escuta do usuário é evidência de preferência. Registre seu alcance; não atribua ao agente uma escuta que ele não realizou. Sem percepção auditiva disponível, entregue A/B e declare esse limite, seguindo a autorização e `review_policy` existentes.
- ASR auxilia a localizar possíveis perdas; pode mudar uma unidade sem que a fala tenha mudado. DNSMOS é previsão, não aprovação perceptiva. Maior atenuação em janelas de baixa energia não é SNR nem prova de ruído removido sem dano à voz.
- Confira duração, alinhamento, loudness e true peak **após a codificação final**, além da relação voz/música/SFX. Use `vid verify`, revisão e `finalize` normalmente; não normalize repetidamente.

Alternativas de consulta: [DPDFNet](https://github.com/ceva-ip/DPDFNet), [RNNoise](https://github.com/xiph/rnnoise), [FFmpeg afftdn](https://ffmpeg.org/ffmpeg-filters.html#afftdn). Consulte-as quando a gravação ou a restrição justificar; não repita um benchmark completo em toda edição.
