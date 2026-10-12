# Qualidade e verificação

## O que é automático

- Validade dos intervalos, cobertura da fonte, presença de evidências/observações, proteção de palavras e trechos obrigatórios.
- Relógio comum de áudio/vídeo, contagem de quadros, origem das palavras e resolução do master.
- Resolução de âncoras após reordenação, identificação de derivados desatualizados e invalidação das aprovações.
- Com estratégia ativa: referências entre evidências/beats, presença de abertura/payoff/CTA escolhido, correspondência temporal no storyboard, vínculo dos cards/reframes e revisão ligada ao hash da estratégia.
- Formato, duração, LUFS, true peak, possíveis telas pretas/congelamentos e diferenças na fala retranscrita.

## O que exige julgamento

Intenção de atuação, melhor take, verdade e completude da explicação, qualidade da entrega, naturalidade das emendas, leitura no celular, utilidade dos gráficos e adequação às referências. O agente registra o que viu e a pessoa pode revisar. Números de áudio não demonstram prosódia; quadros estáticos não demonstram movimento fluido; ASR pode errar palavras.

O [acabamento de cortes](CUTTING.md) exige observações por borda, incluindo abertura e encerramento: fala/gesto completos, pausas funcionais preservadas e sobras de gravação retiradas com evidência. Desvios de olhar e expressões são avaliados no contexto da ação. `frames --cuts --context 0.5` fornece sequência consecutiva; a versão sem contexto é apenas um localizador. A geração dessas imagens não comprova inspeção nem qualidade sonora.

Sem reprodução contínua, todo elemento animado é conferido em quadros consecutivos do render exato (`vid frames --seq`), com recorte quando o detalhe é pequeno. Folhas com quadros espaçados mostram o começo e o fim de uma animação e escondem o meio: um traço que deveria se desenhar e surgia inteiro de uma vez passou por duas entregas assim. Quadros consecutivos mostram se a animação progride, não se o ritmo agrada. Na comparação da fala, confrontar as diferenças com as do render anterior separa o que é hábito do reconhecedor do que um som novo passou a encobrir.

Em conteúdo orgânico, também exigem julgamento: relevância para a audiência, entrega honesta da promessa, qualidade da evidência e coerência da ação desejada. Validação estrutural não comprova persuasão nem prevê alcance. Dados de publicação orientam hipóteses conforme [MARKETING.md](MARKETING.md), sem confundir retenção com resultado de negócio.

Para o bruto de interiores analisado, os critérios prioritários são: escolher uma explicação completa entre as retomadas; remover preparação/final involuntário; preservar gestos; explicar largura/altura/compartimentos com consistência espacial; revisar dimensões e a comparação sobre água; usar um único encerramento. Essas observações orientam uma futura edição, sem editar o original como efeito colateral da implementação.

## Testes

```bash
npm test
npm run skills:check
HF_RENDER_SMOKE=1 node --test tests/workflow.test.mjs
```

Os testes de mídia criam fontes sintéticas em diretórios temporários, verificam deslocamento real do áudio e contagem de quadros no FFmpeg. O teste de fluxo cria e remove somente seu próprio projeto de teste; cobre referências, evidências, seleção, master/proxy, âncoras e invalidação. O modo de render exercita check/render/review/finalize do HyperFrames. Os testes de núcleo cobrem a seleção de quadros consecutivos e a assinatura da composição, que ignora a pasta `snapshots/` de inspeção e continua sensível a qualquer outro arquivo. Observações sintéticas nesses testes exercitam o contrato; não são avaliações artísticas de material humano.

Os testes de estratégia cobrem projeto sem estratégia, adoção explícita, payoff removido, efeitos sem função temporal, demonstração longa sem efeitos/CTA e invalidação após mudança/remoção da estratégia. O fluxo de mídia também passa pela estratégia antes de renderizar. Notas posteriores de aprendizado preservam a entrega. Avisos visuais do fixture sintético devem ser distinguidos de erros do contrato; passar o teste não aprova o design de um projeto real.

Os testes de descoberta cobrem pesquisa local sem alterar projetos, áudio em manifestos legados, separação entre feedback humano e avaliação do agente, direitos ainda não verificados, mudança de arquivo após inspeção e importação com registro preservado. A API é simulada nos testes determinísticos: incluem filtros, unidades de duração, limites de tamanho, HTTP 429 e cache antigo. Consultas reais de Openverse e catálogo são verificações pontuais de acesso, não prova de disponibilidade permanente ou de qualidade dos assets. Veja [consulta de referências](../library/SOURCES.md).

## Referências de projeto

Princípios adaptados, sem instalar motores concorrentes nem copiar os pacotes inteiros:

- [HyperFrames Student Kit](https://github.com/nateherkai/hyperframes-student-kit): prévia com fala/movimento antes do acabamento, abertura verdadeira e continuidade visual.
- [i-hate-editing](https://github.com/ranahaani/i-hate-editing): seleção de takes e conferência de emendas.
- [Open Edits](https://github.com/kevinbadi/open-edits): exame de referências reais de edição.
- [b-roll-finder](https://github.com/louisedesadeleer/b-roll-finder): imagem de apoio coerente com a fala.
- [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html): fps, amostras, offset, HDR e loudness.
- [ElevenLabs STT](https://elevenlabs.io/docs/api-reference/speech-to-text/convert): Scribe v2, palavras/eventos, modo literal e keyterms opcionais.

Skills técnicas vendorizadas: versão e commit em `vendor/skills.lock.json`; licença em `vendor/licenses/`. Não atualizar automaticamente versões no meio de um projeto.

Pesquisa aplicada e alterações de 11/10/2026: [análise das alternativas](RESEARCH-2026-10-11.md) e [critérios editoriais](CRAFT.md). Técnicas de composição conferidas em render e suas armadilhas: [COMPOSITION.md](COMPOSITION.md).

## Regressões de economia e distribuição

`tests/efficiency.test.mjs` confere integridade do cache, ASR reaproveitado com comparação textual nova, diferenças reais em frames/áudio e extração em lote com ordem/duplicatas. `tests/motion.test.mjs` usa GSAP real para conferir poses antes/durante/depois e retorno da timeline. `tests/public-repo.test.mjs` verifica a separação do mecanismo, links, materiais privados forçados no índice e concordância com o Git.

O fluxo sintético também corrige palavras sem alterar a mídia, exige reavaliação editorial e confere a troca proxy/master. `npm run test:render` renderiza os dois tiers no HyperFrames, rejeita a finalização do proxy e entrega o master. Isso verifica o mecanismo; observações da fixture não significam aprovação de material real.

`npm run validate` reúne sintaxe, testes, links de skills e auditoria pública. A cópia produzida por `release:export` deve passar por instalação e validação próprias, sem acesso a `brand/` ou projetos privados.
