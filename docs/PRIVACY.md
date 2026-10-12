# Material privado e publicação do mecanismo

## O que fica local

`videos/`, `brand/`, `output/`, `.cache/`, gravações soltas, pastas de referências pessoais, sessões de agentes, `.env`, logs, relatórios de casos privados e registros de `vid remember` não integram o pacote público. Não é necessário movê-los ou apagá-los para distribuir o mecanismo.

O `.gitignore` nega por padrão arquivos novos na raiz e libera apenas as categorias do mecanismo. Isso não protege arquivos já commitados nem impede `git add -f`. A auditoria também confere candidatos do Git, links, caminhos pessoais, nomes de gravações e alguns formatos de credenciais. Ela reduz erros comuns, mas não detecta todos os segredos ou todo conteúdo sensível possível.

## Gerar uma cópia limpa

```bash
npm run release:check
npm run release:export
```

O export cria `dist/github-ready/`, sem `.git`, dependências instaladas ou processos das edições. Arquivos e links permitidos são listados em `.release-manifest.json`, com hashes. O comando recusa sobrescrever um destino existente; use `--output dist/outro-nome` para outra exportação.

Essa pasta é a unidade recomendada para iniciar um repositório público. Inspecione-a, rode a instalação/verificação descrita no README e então configure o remoto escolhido. Os comandos de preparação não criam conta, repositório remoto, commit ou push.

Se já houver material privado no histórico de outro repositório, um `.gitignore` novo não o remove. Prefira a cópia limpa para a primeira publicação. As regras de permissão ficam em `.gitignore` e `scripts/lib/public-repo.mjs`; mude ambas ao ampliar a distribuição.

## Rede e provedores

Transcrição local e operações FFmpeg não enviam o footage a provedores de ASR. O download de modelos, npm, consulta de websites, Openverse e catálogo exige rede. HyperFrames pode ter sua própria telemetria/configuração; consulte a versão instalada se precisar de um ambiente sem rede.

ElevenLabs é opcional, exige chave local e envia áudio quando explicitamente selecionado. A consulta a referências não autoriza publicar, abrir contas ou enviar briefings privados. Assets obtidos fora do projeto precisam de origem e licença registradas antes do uso.

O cache de ASR e de imagens também contém material privado. Não o envie em issues, PRs ou pacotes de diagnóstico.
