# Instalação e primeiro projeto

## Começar conversando com a IA

Abra o repo no Claude Code ou Codex e peça a edição em linguagem natural. Na primeira tarefa de vídeo, quando ainda não houver projetos, a IA apresenta uma orientação curta sobre o processo, objetivos, referências e escolha de modelo. Não é preciso conhecer os comandos abaixo para pedir uma edição.

Informe o vídeo, o público, a plataforma e o resultado desejado. Envie referências e explique o que aproveitar de cada uma: ritmo, legendas, cores ou modo de explicar. Diga também o que evitar. Um modelo com bom raciocínio e visão ajuda a julgar fala, gestos e imagens; os nomes no [texto de boas-vindas](../templates/WELCOME.md) são exemplos, sujeitos à disponibilidade no aplicativo, não requisitos de instalação.

A apresentação não exige confirmação nem repete informações já fornecidas. O agente continua o pedido e pergunta apenas o que faltar para uma decisão importante. Para reler a orientação: `node scripts/vid.mjs welcome --preview`.

## Requisitos

- Node.js 22 ou superior e npm; Git para contribuição/atualização das skills.
- FFmpeg e ffprobe 6 ou superior, com libx264, drawtext, tile, loudnorm, zscale e tonemap. Os dois últimos são necessários para fontes HDR.
- Chromium utilizável pelo HyperFrames para check/snapshot/render. O diagnóstico do CLI orienta a instalação quando necessário.
- Um modelo local de fala para transcrição; o teste sintético do mecanismo não exige modelo nem conta externa.

O ambiente de referência é Linux. Para Windows, use WSL2 com suporte a links simbólicos. macOS não tem cobertura automatizada nesta versão.

Clone o [repositório oficial](https://github.com/leosamorim/ai-videos) e instale na própria pasta de trabalho:

```bash
git clone https://github.com/leosamorim/ai-videos.git
cd ai-videos
HYPERFRAMES_SKIP_SKILLS=1 npm ci
npm run skills:sync
npm run validate
node scripts/hf.mjs doctor
node scripts/hf.mjs models list
node scripts/hf.mjs models install parakeet
npm run doctor
```

O `doctor` do mecanismo verifica as dependências e a disponibilidade de ASR. Não instale skills globais por meio do CLI. O reconhecimento padrão usa a configuração de idioma do projeto; português não deve cair em um modelo `.en`. Consulte as opções da versão instalada antes de trocar engine/modelo.

Não é necessário criar `brand/`. Inter e uma aparência genérica estão incluídos. Para uma identidade própria, consulte [BRANDS.md](BRANDS.md).

## Atualizar o mecanismo

Na branch `main`, confira `git status` e conclua ou guarde alterações de código antes de atualizar:

```bash
git pull --ff-only origin main
HYPERFRAMES_SKIP_SKILLS=1 npm ci
npm run skills:sync
npm run validate
```

Se o Git apontar divergência, resolva as alterações pela branch de trabalho antes de continuar. Não use `reset --hard` ou `git clean -fdx` como limpeza: eles podem apagar trabalho local, inclusive projetos e mídia ignorados. A atualização do mecanismo não exige apagar `videos/`, `brand/`, `library/references/` ou os caches de produção.

`dist/` é saída de exportação, não instalação nem checkout alternativo. Depois de conferir um export, descarte somente aquela pasta gerada. As skills de `.agents/skills/` são links para `.claude/skills/`; mantenha essa origem única.

## Exemplo de uso

Crie um projeto com um caminho para uma gravação sua:

```bash
node scripts/vid.mjs new exemplo --source /caminho/gravacao.mp4 --review assisted
node scripts/vid.mjs resume exemplo
```

O agente deve ler `AGENTS.md` e usar `video-edit`. Preencha o briefing e estabeleça a intenção. `assisted` pede revisão real dos cortes e do draft; `autonomous` permite ao agente concluir dentro do escopo autorizado, documentando observações. Nenhum dos modos publica o vídeo.

O fluxo é deliberadamente editorial, com arquivos intermediários a preencher:

1. Concluir intake, registrar referências e, quando houver objetivo de marketing, estratégia.
2. Transcrever, examinar evidências e preencher `edit-plan.json`. Conferir gesto, fala e contexto antes de cortar.
3. Validar/cortar; em modo assistido, revisar o corte concreto. Preencher e validar o storyboard.
4. Preparar a composição com `compose exemplo --media proxy`, construir os gráficos e rodar `check`/`render --quality draft`.
5. Depois dos ajustes, executar `compose exemplo --media master`, revisar os tempos autorais, rodar `check` e `render --quality looks`.
6. Verificar e inspecionar esse render exato, preencher `review.json`, concluir a revisão e finalizar.

A tabela completa de comandos, formatos JSON e regras de aprovação está em [PIPELINE.md](PIPELINE.md). Não marque gates como aprovados para contornar etapas pendentes.

## Retomar uma revisão

```bash
node scripts/vid.mjs resume exemplo --chars 10000
node scripts/vid.mjs words exemplo --from 20 --to 45
```

O resumo é somente leitura e limitado; não substitui a leitura completa da fala na seleção inicial. Reabra apenas as skills e evidências pertinentes à alteração. Veja [EFFICIENCY.md](EFFICIENCY.md).
