# Contribuindo

Use Node.js 22 ou superior, FFmpeg/ffprobe 6 ou superior com libx264, drawtext, tile, loudnorm e filtros de conversão de cor. Linux é o ambiente de referência; Windows deve usar WSL2. Instale com `HYPERFRAMES_SKIP_SKILLS=1 npm ci`.

1. Abra uma issue com o problema e um exemplo sintético reproduzível. Não anexe footage de clientes, transcrições privadas, tokens ou logs completos de sessões.
2. Crie uma branch. Mantenha mudanças de infraestrutura separadas de direção editorial.
3. Altere as skills canônicas em `.claude/skills/`. `.agents/skills/` contém links; rode `npm run skills:sync` se adicionar/remover skills.
4. Cubra regressões de relógio, dependência, proveniência e mídia com testes reais quando a mudança atingir esses contratos. Testes não devem exigir projetos privados, chaves pagas ou rede para passar.
5. Execute `npm run validate`. Para mudanças de composição, mídia ou entrega, execute também `npm run test:render`.
6. Explique na PR o problema, a mudança de comportamento, as verificações e qualquer limitação real.

Não mude o reconhecedor de fala, a versão do HyperFrames, o formato dos projetos ou o mecanismo de revisão incidentalmente. Atualizações de vendor precisam manter versão, lockfile, licença, política local e testes alinhados. Nunca codifique uma preferência de uma marca como regra global.

Ao alterar sinais audiovisuais, siga [SIGNALS.md](docs/SIGNALS.md): mantenha modelos/hashes fixados, valide offsets e cobertura e rode a integração nativa com fonte sintética (`VID_SIGNALS_SMOKE=1 node --test tests/signals.test.mjs`, após `signals setup --pose`). O teste normal não instala extras nem acessa rede; a CI oferece o teste nativo por acionamento manual. Não transforme probabilidades ou ângulos em decisões automáticas de descarte.

O export público é produzido por `npm run release:export`. Ao acrescentar uma categoria de arquivo distribuído, atualize `.gitignore`, `scripts/lib/public-repo.mjs` e seus testes juntos. Arquivos ignorados já rastreados continuam no Git: a auditoria deve passar antes de abrir a PR.
