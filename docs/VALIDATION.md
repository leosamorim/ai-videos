# Verificação da versão 0.2.0

## Organização do repositório e distribuição — 2026-10-13

O clone oficial passa a ser a origem documentada de instalação, atualização e contribuição. Git e export excluem temporários de editor, bytecode, cobertura e caches de ferramentas; o teste de distribuição confere a exclusão dos arquivos e rejeita resíduos adicionados à força no índice.

`npm run validate`: 71 testes aprovados, 2 integrações opcionais omitidas, sintaxe JavaScript/Python válida, 20 skills sincronizadas e 662 arquivos públicos sem problemas. `npm run test:render`: 3 testes aprovados com Chromium/HyperFrames e mídia sintética. Um export em diretório temporário passou por `npm ci` e `npm run validate` sem projetos, marca ou mídia privada; a pasta temporária foi removida após a checagem. Métricas de casos privados não integram este relatório.

## Direção, leitura e eventos compartilhados — 2026-10-13

`npm run validate`: 71 testes aprovados, 2 integrações opcionais omitidas (browser/render e modelos locais), 59 arquivos JavaScript e 1 Python com sintaxe válida; 20 skills sincronizadas e auditoria de 662 arquivos públicos sem problemas. As sete skills alteradas passaram no validador de estrutura.

`npm run test:render`: 3 testes aprovados, incluindo browser real e fluxo HyperFrames completo com proxy/draft, master/looks, verify, revisão sintética, diff e finalize. A cópia pública foi exportada para diretório temporário, instalada com `npm ci` e aprovada nos mesmos comandos, sem projetos, marca ou mídia privada. O export inclui um manifesto adicional; não foi feito push nesta alteração.

Cobertura acrescentada:

- Âncoras movem evento, ataque do som e janelas de leitura juntos; palavras removidas/repetidas, IDs conflitantes, vínculos ausentes e limites inválidos falham cedo. Antecipação sonora explícita permanece possível.
- Áudio gerenciado não se duplica ao repetir `compose`; seu bloco é atualizado/removido preservando conteúdo autoral. `check` rejeita alteração manual dos tempos. FFprobe confere duração/áudio real; hashes identificam assets; links para fora da pasta de assets são recusados.
- Leitura usa a janela declarada de estabilidade, mostra estados distintos e identifica cards não avaliados. Alterar texto/evento invalida o plano e derivados; nova compilação usa os novos dados. Avisos não impedem render nem aprovam percepção.
- SVG normalizado tem poses intermediárias contínuas. Nove instantes não cronológicos, incluindo zero, bordas, contato e fim, foram comparados por estado DOM e pixels com páginas novas. Esse teste revelou e permitiu corrigir diferenças de inicialização em zero.
- No MP4 master sintético, pixels do traço aumentam em três quadros intermediários. O áudio decodificado separa um cue de 3 kHz do tom de fundo: ausência antes do ataque, presença no contato compartilhado e fim sem repetição. É teste de sincronismo por sinal, sem alegação de escuta.
- A política de direção reaplica-se após reposição do material vendor e é idempotente; exemplos técnicos são preservados. As novas rotas de fontes passam pela validação do catálogo existente.

Os campos são opcionais e não exigem migração de projetos existentes. Os testes comprovam contratos técnicos, não superioridade artística ou desempenho de marketing. O relatório de leitura depende de declarações e não detecta oclusão, contraste ou texto realmente concluído nos pixels.

## Base da versão

Executada localmente em 2026-10-12, no Linux, com FFmpeg n9.0.1, HyperFrames 0.8.145 e GSAP 3.15.0.

| Verificação | Resultado |
| --- | --- |
| Testes de núcleo, mídia, cache, distribuição e fluxo | 48 aprovados; executados com Node 26.8.1 e também Node 22.23.3 |
| Sintaxe do código original JavaScript | 48 arquivos válidos |
| Espelho de skills | 20 skills, sem links divergentes |
| Skills editoriais alteradas | `video-edit`, `video-editorial` e `video-review` aprovadas no validador de estrutura |
| Render real HyperFrames | Prévia proxy/draft e master/looks; check, verify, review, diff e finalize aprovados em fonte sintética |
| Render na cópia pública, com Node 22 | Aprovado sem marca, projetos ou mídia privada do workspace |
| Arquivo sintético de entrega | 1080×1920, 30 fps, 72 quadros, 2,4 s, áudio AAC; verificação técnica sem erros |
| Publicação | Auditoria da lista pública, rejeição de material privado forçado no índice e export com manifesto de hashes |
| Documentação própria | Links locais conferidos |

O teste de render inclui entrada, traço, aproximação e clique. Os testes GSAP verificam poses intermediárias e seeks em ambos os sentidos. O diff é exercitado com mudanças reais em dois quadros, mudança somente de áudio e incompatibilidade de tempo/cor. A correção de palavras exige nova validação editorial mesmo quando o master pode ser reutilizado.

Os testes usam observações sintéticas para exercitar os contratos de revisão. Não comprovam qualidade artística, resultado de marketing ou percentual de economia na assinatura. Não foi feita nova edição de material do usuário como parte dessa implementação. A configuração de CI foi incluída nessa etapa; as execuções públicas ficam em [GitHub Actions](https://github.com/leosamorim/ai-videos/actions).

## Adição da orientação de primeiro uso

Verificada em 2026-10-12 com `npm run validate`: 52 testes aprovados, 51 arquivos JavaScript com sintaxe válida e 20 skills sincronizadas. `video-edit` também passou no validador de estrutura. Os novos testes exercitam um workspace vazio sem dependências instaladas, projetos existentes e vinculados, consulta sem gravação, registro explícito sem repetição, releitura e registro inválido. O teste de distribuição confirma que `.local/welcome.json` fica fora da cópia pública. Os testes de mídia continuam passando; esta alteração não muda composição ou render e não exigiu novo render HyperFrames.

## Acabamento de cortes e inspeção das bordas

Verificado em 2026-10-12 com `npm run validate`: 56 testes aprovados, 51 arquivos JavaScript válidos, 20 skills sincronizadas e auditoria pública de 649 arquivos sem problemas. As três skills editoriais alteradas passaram no validador de estrutura.

Os testes cobrem abertura/encerramento de um take único, trechos reordenados, fps fracionário, contexto limitado aos quadros existentes, argumentos inválidos e EDL incompatível com o vídeo. A integração FFmpeg compara pixels extraídos com os quadros reais antes/depois de uma emenda, incluindo o primeiro quadro do novo trecho. A integração CLI confere o manifesto de índices e a inspeção localizada do encerramento.

`npm run test:render` também passou: proxy/draft, master/looks, verificação, revisão sintética, diff e finalização pelo HyperFrames fixado. A mídia de teste mantém 1080×1920, 30 fps, 72 quadros e 2,4 s. A seleção e os filtros de áudio não foram substituídos; nenhum vídeo de usuário foi editado. Os testes comprovam execução e rastreabilidade, não julgamento automático de expressão, escuta ou qualidade artística.

## Sinais locais de fala, rosto e gesto

Integração verificada em 2026-10-12: `npm run validate` com 64 testes aprovados e 1 integração opcional omitida; 55 arquivos JavaScript e o worker Python com sintaxe válida, 20 skills sincronizadas. As três skills editoriais passaram no validador de estrutura. `npm run test:render` passou com o HyperFrames fixado, incluindo draft/master, verificação, diff e finalização sintética.

A cópia pública também foi exportada, instalada com `npm ci` e aprovada em `npm run validate`, sem os modelos, gravações, marcas ou projetos privados do workspace.

O runtime foi instalado em venv separado pelo próprio `signals setup --pose`, usando Python 3.12.14, Silero ONNX, ONNX Runtime 1.31.0 e MediaPipe 0.10.32. O setup verificou hashes e carregou os três modelos. `VID_SIGNALS_SMOKE=1 node --test tests/signals.test.mjs` aprovou os 9 testes, incluindo execução nativa, cache, repetição do áudio, contexto de bordas reordenadas, `inspect --face`, atualização do resumo e preservação de decisões. A validação normal continua funcionando sem extras.

O teste de relógio usa pulsos PCM sintéticos com offsets positivo e negativo e verifica a amostra exata. Os testes rejeitam relatórios fora do relógio/cobertura, fonte alterada, bytes corrompidos e resumo antigo após mudança do plano. Atividade breve permanece no resumo VAD; orientação da cabeça não gera julgamento de atuação; variações visuais não atravessam janelas sem amostragem.

Benchmarks de gravações privadas e suas métricas permanecem locais. A validação distribuída usa mídia sintética e não estabelece precisão de detecção de erros, superioridade editorial nem aprovação dos cortes. Sinais continuam auxiliares ao julgamento audiovisual.
