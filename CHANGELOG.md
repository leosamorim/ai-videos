# Changelog

## Não publicado

- Repositório oficial como origem única de instalação/desenvolvimento; exports tratados como saídas descartáveis. Metadados de GitHub e regras de Git/export alinhadas para excluir temporários de editor, bytecode e cobertura.
- Direção por beat (atuação, explicação ou motion), estruturas de comparação/processo/detalhe e precedência editorial explícita nas skills técnicas, preservada por `skills:policy` nas atualizações.
- Eventos do storyboard compartilhados entre animação e SFX, com ataque do asset, limites de timeline, validação de mídia e áudio gerenciado por `compose`; clique pode receber o instante de contato diretamente.
- Janelas declaradas de leitura útil, relatórios consultivos em `plan/check` e revisão por problema/intervalo, sem notas artificiais ou aprovação automática. Rotas de referência de motion consultáveis por função, sem novo engine/dependências.
- Estados iniciais explícitos evitam diferenças entre seek direto em zero e rebobinar; traço SVG sem arredondamento para paths normalizados. Regressões de seek/DOM, sincronismo e render exercitadas com mídia sintética.

- Silero ONNX integrado ao `analyze` como extra local; MediaPipe Face em inspeções/janelas de borda e Pose opcional para gestos. Relatórios por origem, cache verificável, avisos em `editorial`/`cut` e retomada compacta, sem seleção ou aprovação automática.
- `signals setup` instala modelos fixados com SHA-256 e runtime isolado; testes de relógio, integridade, preservação de decisões e integração nativa opcional. Guia SIGNALS e skills orientam quando cada ferramenta acrescenta valor.

- DeepFilterNet3 como opção inicial de limpeza de fala quando necessária; guia de tratamento moderado, compensação de atraso, integração por faixa separada e revisão A/B por projeto, sem incluir gravações ou instalar modelos automaticamente.
- Direção geral de acabamento dos cortes: preservar fala e ação úteis, distinguir reset de expressão intencional e classificar pausas/ruídos pelo contexto, com evidências por borda.
- `frames --cuts` inclui abertura e encerramento e usa índices exatos; `--context` extrai sequências consecutivas e `--boundary` limita a inspeção. `cut` gera roteiro de revisão por borda, sem novo schema ou aprovação automática.
- Orientação curta no primeiro fluxo de vídeo, com objetivos, referências, exemplos de modelos e um exemplo de pedido; integrada às instruções de Claude Code e Codex.
- `vid welcome` detecta projetos sem modificar estado; registro local evita repetição e `--preview` permite reler. Nenhum dado de primeiro uso entra na distribuição pública.

## 0.2.0 — 2026-10-12

- Retomada compacta e somente leitura com `vid resume`.
- Cache local por conteúdo para ASR original, cobertura visual, inspeções detalhadas e master/proxy de cortes; correções semânticas continuam invalidando revisões.
- Prévia com `compose --media proxy`, metadados rastreáveis e bloqueio de entrega em proxy.
- Extração em lote de quadros por índice/PTS, folhas reutilizáveis e hashes dos arquivos de evidência.
- Comparação integral de frames decodificados e PCM com `vid diff`; expansão de intervalos por animação e bordas, sem aprovação automática.
- Primitivas GSAP reutilizáveis e logs resumidos de check/render.
- Fontes genéricas locais licenciadas; marca privada passa a ser opcional.
- Distribuição somente do mecanismo, auditoria/export público, licença MIT, documentação de contribuição e CI.

## 0.1.0

Base do pipeline: referências, estratégia, transcrição, seleção audiovisual, cortes ancorados, composição HyperFrames e revisão vinculada ao render. Esta entrada documenta a base local anterior; não representa uma release pública previamente publicada.
