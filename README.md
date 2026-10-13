# AI Videos

Mecanismo local de edição audiovisual assistida por agentes, com FFmpeg e HyperFrames. A seleção usa fala, gestos e imagens; decisões editoriais ficam rastreáveis até o render revisado.

O repositório distribui **somente o mecanismo**. Gravações, marcas, briefings, transcrições, referências pessoais e renders permanecem locais.

A versão mantida está em [leosamorim/ai-videos](https://github.com/leosamorim/ai-videos), na branch `main`. Use o clone como pasta de trabalho; `dist/` contém apenas exportações descartáveis para verificar a distribuição.

## Capacidades

- Seleção e reordenação de takes com evidências audiovisuais, proteção de palavras e preservação de demonstrações úteis.
- Sinais locais opcionais de fala (Silero) e rosto/gestos (MediaPipe), com cache, para orientar inspeção e avisar sobre bordas duvidosas.
- Referências de sites, documentos e vídeos; estratégia de conteúdo orgânico vinculada a promessa, evidência, payoff e CTA.
- Legendas e gráficos ancorados em palavras, reframes e primitivas GSAP de entrada, traço e clique.
- Master em resolução original, prévia em proxy e entrega verificada.
- Cache por conteúdo, retomada compacta, extração em lote e comparação integral entre renders para reduzir retrabalho.
- Skills canônicas para Claude Code e links locais para Codex, com versões técnicas fixadas.

O agente faz o julgamento editorial. Silêncio, olhar lateral ou pausa não comprovam fim de atuação. Verificações técnicas e ASR não substituem avaliação de sentido, naturalidade e qualidade artística.

## Começar

Abra este repo no Claude Code ou Codex e peça uma edição. Se ainda não houver projetos, a IA explica brevemente como funciona e como passar objetivos e referências. A orientação pode ser relida com `node scripts/vid.mjs welcome --preview`; veja o [guia de primeiro uso](docs/GETTING_STARTED.md).

Requisitos: Node.js ≥22, FFmpeg/ffprobe ≥6 e ambiente Chromium compatível com o HyperFrames. Linux é o ambiente de referência; use WSL2 no Windows.

```bash
git clone https://github.com/leosamorim/ai-videos.git
cd ai-videos
HYPERFRAMES_SKIP_SKILLS=1 npm ci
npm run skills:sync
npm run validate
node scripts/hf.mjs doctor
node scripts/hf.mjs models list
```

Instale um modelo de fala conforme o [guia de início](docs/GETTING_STARTED.md). Depois:

```bash
node scripts/vid.mjs new exemplo --source /caminho/gravacao.mp4 --review assisted
node scripts/vid.mjs resume exemplo
```

Peça ao agente que siga `AGENTS.md` e a skill `video-edit`, informando objetivo, referências e escopo. Em `assisted`, ele apresenta o corte/draft para revisão; em `autonomous`, conclui as etapas autorizadas com evidências registradas. Publicação requer um pedido separado.

## Fluxo

Briefing e referências → transcrição + inspeção audiovisual → seleção/EDL → storyboard → composição em proxy → revisão → render do master → verificação e entrega.

Para revisões, `vid resume` evita recarregar todo o histórico. `compose --media proxy` permite iterar mantendo canvas e relógio. A entrega exige `--media master` e revisão do render exato. O [guia de eficiência](docs/EFFICIENCY.md) explica cache e revisão incremental sem relaxar os critérios de qualidade.

## Documentação

| Assunto | Documento |
| --- | --- |
| Instalação e primeiro projeto | [Começar](docs/GETTING_STARTED.md) |
| CLI, esquemas e etapas | [Pipeline](docs/PIPELINE.md) |
| Economia de contexto e processamento | [Eficiência](docs/EFFICIENCY.md) |
| Organização e contratos | [Arquitetura](docs/ARCHITECTURE.md) |
| Direção editorial e marketing | [Craft](docs/CRAFT.md), [marketing](docs/MARKETING.md) |
| Bordas de takes, pausas e ruídos | [Acabamento de cortes](docs/CUTTING.md) |
| Silero e MediaPipe: instalação e uso na seleção | [Sinais audiovisuais](docs/SIGNALS.md) |
| Limpeza de fala: preferência por DeepFilterNet3, integração opcional e revisão | [Áudio](docs/AUDIO.md) |
| Fontes de consulta autônoma | [Biblioteca](library/SOURCES.md) |
| Composição e movimentos | [Técnicas](docs/COMPOSITION.md), [componentes](docs/COMPONENTS.md) |
| Direção de motion e explicações | [Coreografia, eventos de som e tempo útil de leitura](docs/CHOREOGRAPHY.md) |
| Estilos locais | [Marcas](docs/BRANDS.md) |
| Revisão e limites de verificação | [Qualidade](docs/QUALITY.md) |
| Publicação sem material privado | [Privacidade](docs/PRIVACY.md) |
| Compatibilidade com projetos anteriores | [Migração](docs/MIGRATION.md) |

## Desenvolvimento

```bash
npm run validate
npm run test:render
npm run release:check
npm run release:export
```

Os testes usam fontes sintéticas. O teste de render exige Chromium e exercita o caminho HyperFrames real. `release:export` gera `dist/github-ready/`, sem histórico Git ou projetos privados, e recusa sobrescrever uma pasta existente. Nenhum comando acima faz push.

Para atualizar um clone existente, siga [Atualizar o mecanismo](docs/GETTING_STARTED.md#atualizar-o-mecanismo). Contribuições são feitas no clone, por branch e pull request; não mantenha uma segunda versão editável em `dist/`.

Leia [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [SUPPORT.md](SUPPORT.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) e [CHANGELOG.md](CHANGELOG.md).

## Licença

Código original sob [MIT](LICENSE). Skills técnicas HyperFrames, fontes Inter e GSAP mantêm suas próprias licenças; consulte [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Materiais de projetos não recebem licença pelo fato de usarem este mecanismo.
