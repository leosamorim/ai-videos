# Repertório consultável pela IA

O ganho vem de encontrar uma referência que resolva uma decisão concreta, inspecioná-la e lembrar o que serviu. Textura, trilha, SFX e variedade não são requisitos para parecer humano. Cada vídeo precisa de uma linguagem coerente com a pessoa, o assunto e a intenção.

O catálogo consultável está em [sources.json](sources.json), com finalidade, categorias, acesso, licença/fonte, data e limites da conferência. As rotas não são exemplos já avaliados. O catálogo é versionável; referências pessoais em `library/references/*.json` e caches em `.cache/` ficam locais.

## Como o agente consulta sozinho

1. **Formular a lacuna:** “tornar esta comparação legível”, “mostrar a passagem entre duas etapas”, “som discreto para uma ação física”. Usar a necessidade do beat e o contexto de `strategy.json`, quando houver. Evitar buscas genéricas como “vídeo viral premium”.
2. **Buscar localmente:** `vid discover` encontra materiais em manifestos de projetos, seus renders finais, assets de marca e referências lembradas. Não trata finalização como preferência humana. Material de outra marca é repertório; não vira automaticamente B-roll deste projeto.
3. **Escolher a rota externa:** a saída indica fonte, modo de acesso e consulta sugerida para web/browser. Para imagem/áudio, há busca real no Openverse; para componentes, no catálogo HyperFrames. Escolher fontes de edição real antes de procurar efeitos quando a lacuna é narrativa/ritmo.
4. **Inspecionar o exemplo:** abrir a página original, observar o trecho relevante e anotar o que foi efetivamente visto/ouvido. Para ritmo, transições ou som, texto de página e thumbnails não bastam. Se só há frames, a observação deve ter esse limite.
5. **Aplicar e lembrar:** registrar o que emprestar, o que evitar e em qual contexto. Importar a referência escolhida para o projeto com `vid reference`. Verificar no render se a adaptação ajudou.

Em um projeto novo, comparar algumas referências distintas costuma bastar para escolher uma direção. Em uma revisão pontual, pesquisar só a lacuna identificada. Pare quando houver material suficiente para decidir; mais exemplos não justificam atrasar a edição. Prefira a referência do usuário quando ela já resolve a intenção.

```bash
# Sem rede: procura material real local e sugere fontes externas adequadas.
node scripts/vid.mjs discover "armário demonstração" --kind editing --json
node scripts/vid.mjs discover "cozinha" --kind image --project exemplo --json

# Busca real de metadados públicos, sem chave. Ainda não baixa nem aprova assets.
node scripts/vid.mjs discover "soft paper movement" --kind sfx --online openverse --limit 5 --json
node scripts/vid.mjs discover "ambient instrumental" --kind music --online openverse --limit 5 --json
node scripts/vid.mjs discover "paper texture" --kind texture --online openverse --limit 5 --json

# Catálogo da versão instalada, com consulta em inglês; não instala componentes.
node scripts/vid.mjs discover "reveal a comparison" --kind motion --online catalog --limit 5 --json
```

Categorias: `editing`, `motion`, `typography`, `image`, `video`, `texture`, `sfx`, `music`, `icon`, `palette`. `--limit` aceita 1–20. Sem consulta, retorna um inventário resumido. A busca local é lexical, com acentos normalizados; tente sinônimos ou inventário por categoria quando não houver correspondência. `--project` restringe os manifestos/renders pesquisados; a biblioteca lembrada e assets de marca continuam disponíveis e precisam de conferência de contexto.

O Openverse busca imagens ou áudio, não vídeos. O filtro pede CC0/CC BY, mas o resultado mantém `rights.status: unverified`. O próprio serviço orienta conferir a licença no original. Duração de áudio é convertida de milissegundos para segundos; a URL pode apontar ao preview comprimido. Para o master, confira o provedor. [Documentação do Openverse](https://docs.openverse.org/api/reference/made_with_ov.html), [acesso anônimo e limites](https://docs.openverse.org/packages/js/api_client/index.html).

As consultas online enviam somente a expressão passada pelo agente. Use termos genéricos; não enviar briefing/transcrição, nomes privados ou material confidencial. Há cache local por consulta durante 24 h e `--refresh` para renová-lo. Timeout/429/erro devolve `unavailable` ou `stale-cache`, com motivo e data; não há loop de tentativas. Cache velho continua sendo velho, não verificação atual de direitos.

## Rotas prioritárias

| Necessidade | Primeiro consultar | Uso editorial |
| --- | --- | --- |
| Ritmo, abertura e passagem de ideia | Próprios renders/feedback; [Eyecandy](https://eyecannndy.com/) | Observar uma decisão em contexto; não copiar marca ou presumir desempenho |
| Demonstração espacial | Materiais reais; [Never Too Small](https://www.nevertoosmall.com/) quando o domínio combinar | Relação entre detalhe, espaço, planta e explicação; episódios precisam ser examinados |
| Som discreto e ambiente | Áudio da própria gravação; Openverse, [Kenney](https://kenney.nl/assets/interface-sounds), [Freesound](https://freesound.org/), [Mixkit](https://mixkit.co/) | Escolher pelo gesto/material e pela voz; não usar whoosh em todo corte |
| Textura material | Catálogo local; [ambientCG](https://ambientcg.com/) | Sutileza e coerência com a marca; baixar só o necessário |
| Tipografia em uso | Fontes já locais; [Fonts In Use](https://fontsinuse.com/), [Fontsource](https://fontsource.org/) | Hierarquia e legibilidade; conferir licença e cobertura dos glifos da família |
| Movimento ou anotação | Catálogo HyperFrames, [GSAP](https://gsap.com/docs/v3/Eases/), [Rough.js](https://roughjs.com/) | Adaptar função e curva à timeline; seed fixo e render determinístico |
| Coreografia de explicações | [Guia local](../docs/CHOREOGRAPHY.md), ClaudeAnimationBase e Lemo Opuscar | Escolher ordem de atenção, estados de comparação/processo e tempo útil de leitura; consultar a gramática necessária |
| Referências de motion gerado | Awesome AI Motion e Awesome Claude 5.5 Videos | Abrir casos pertinentes e testar a técnica incerta; não usar popularidade como benchmark nem catálogos de motion como direção de cortes de atuação |
| Ícones | [Lucide](https://lucide.dev/) ou família já usada no projeto | Um sistema de traço coerente; não adicionar ícones só para preencher espaço |
| B-roll externo | [Pexels](https://www.pexels.com/) depois de esgotar o material pertinente do projeto | Contexto, sem apresentar stock como prova de um trabalho real |
| Mensagens de mercado | Creative Center e Ad Library, se acessíveis | Estudar anúncios como referências; não inferir sucesso orgânico ou vendas por anúncio ativo |

Detalhes de acesso e termos ficam no JSON, consultados pelo comando. Não é preciso abrir todas as fontes em todo projeto. A variedade deve acontecer entre soluções adequadas a cada peça, não em movimentos aleatórios dentro de uma mesma peça.

Para essas rotas de motion, `vid discover "comparacao diagrama" --kind motion --json` ou `"coreografia atencao"` encontra o guia/catálogo pertinente. O comando sugere a rota; use web/browser para consultar JSON/CSV público e abrir os exemplos escolhidos. Não há ingestão em massa nem download automático. O Awesome AI Motion exclui protagonistas reais em seus critérios; para atuação/ritmo de fala, continue pelas referências de edição real e feedback do usuário.

## Browser, bloqueios e arquivos locais

O agente pode usar as ferramentas web/browser disponíveis na sessão para seguir a consulta sugerida e abrir exemplos, dentro da tarefa autorizada. `discover` não controla navegador nem faz scraping de plataformas sociais. Se a página depende de JS, tentar a navegação normal. Se houver bloqueio, login indisponível ou paywall, registrar a limitação e escolher outra fonte acessível. Solicitar material ao usuário só quando aquela referência específica for indispensável. Não contornar controles de acesso.

Pexels tem API oficial com chave; Freesound oferece API/autenticação e previews com condições próprias. Esses adaptadores autenticados não foram implementados aqui. “Não abriu por fetch” não equivale a “a IA nunca consegue acessar”. [Pexels API](https://help.pexels.com/hc/en-us/articles/47677890260761-Is-the-Pexels-API-free-to-use), [Freesound FAQ](https://freesound.org/help/faq/).

Para uma referência selecionada:

```bash
node scripts/vid.mjs reference meu-projeto https://pagina-do-exemplo.example --role editing
node scripts/vid.mjs reference meu-projeto /caminho/efeito.wav --role audio
node scripts/vid.mjs reference meu-projeto /caminho/textura.png --role texture
node scripts/vid.mjs reference meu-projeto /caminho/fonte.woff2 --role font
node scripts/vid.mjs reference meu-projeto --library minha-referencia --role editing
```

Captura remota tem limite padrão de 8 MB; `--max-mb 64` pode ampliá-lo para uma mídia selecionada (máximo 256 MB). Não segue o site recursivamente. O tipo MIME preserva extensão para vídeo, áudio, imagem e fonte conhecidos; tipo desconhecido fica `.bin` e requer inspeção. Capturar um URL de página de vídeo não baixa automaticamente o vídeo incorporado.

Para um vídeo local, `vid frames SLUG --file CAMINHO --every 1 --name referencia` prepara uma visão geral; abra as folhas. Use player/trecho denso para analisar movimento e áudio. Para música/SFX, escuta é necessária para afirmar timbre/agradabilidade; metadados e forma de onda não comprovam isso. Ao adotar um asset, congele arquivo, origem, licença e créditos no projeto; não faça hotlink na composição.

## Memória de referências avaliadas

O agente escreve um JSON e usa `vid remember /caminho/analise.json`. A pasta `library/references/` recebe registros locais pesquisáveis. Um registro distingue observação, função transferível, limitações e autoria do feedback. Não deduzir preferência do usuário de `review_policy: autonomous` ou de uma entrega concluída.

Formato ilustrativo (substituir pelo material efetivamente examinado):

```json
{
  "schema": 1,
  "id": "comparacao-com-respiro",
  "title": "Comparação com espaço para observar",
  "kinds": ["editing"],
  "tags": ["comparação", "demonstração", "ritmo"],
  "source": {"file": "/caminho/real/referencia.mp4"},
  "context": "Explicação visual para iniciantes; aplicar quando os detalhes precisam ser comparados.",
  "inspection": {"method": "playback", "notes": "Registrar intervalo e observação reais; não declarar playback se só viu frames."},
  "borrow": "Descrever a decisão útil, com intervalo: tempo de observar antes da conclusão, por exemplo.",
  "avoid": "Descrever o que não transferir: logo, voz, cores ou um efeito fora de contexto.",
  "feedback": {"by": "agent", "verdict": "neutral", "evidence": "Avaliação editorial do agente; ainda não há preferência expressa do usuário."},
  "rights": {"use": "reference-only", "status": "unverified", "notes": "Estudar a decisão de montagem; não incorporar o clip à entrega."}
}
```

`source.url` também é aceito; caminhos de arquivo são absolutos ou relativos à raiz do repo. Métodos: `page`, `frames`, `playback`, `listening`, `user-feedback`. Veredictos: `neutral`, `preferred`, `avoid`, `mixed`; `by` é `agent` ou `user`. Feedback humano exige registrar a origem/frase/ocasião que o sustenta. Uma rejeição pode ser útil: guardar o contexto evita repetir o problema sem proibir aquela técnica globalmente.

`rights.use`: `reference-only`, `adapt` ou `asset`; `status`: `unverified`, `licensed` ou `owned`. Adaptar código e usar mídia exigem direitos conferidos; um estudo visual pode permanecer `reference-only`. Para `licensed`, preencher também `license` e `source` da licença; incluir crédito/restrições nas notas. Licença é uma declaração documentada pelo agente, não uma aprovação jurídica automática.

O registro de arquivo local guarda SHA-256. `reference --library` rejeita arquivo alterado desde a inspeção e copia o registro para o projeto, mantendo a proveniência mesmo que a memória depois mude. `remember --replace` é uma revisão explícita e arquiva a versão anterior. Buscar/lembrar não altera gates de projetos; importar uma referência invalida a direção pertinente, como já acontece no fluxo.

## O que foi corrigido ou mantido sob demanda

- **Animate.css:** a licença atual consultada é Hippocratic 2.1. Não foi incorporado como dependência; o runtime existente cobre as entradas necessárias. [Licença primária](https://raw.githubusercontent.com/animate-css/animate.css/main/LICENSE).
- **GL Transitions:** a licença foi identificada como MIT no repositório. **Paper Shaders:** Apache-2.0. Continuam rotas secundárias, pois adicionar GPU/complexidade só ajuda quando há uma função concreta. [GL](https://raw.githubusercontent.com/gl-transitions/gl-transitions/master/LICENSE), [Paper](https://raw.githubusercontent.com/paper-design/shaders/main/LICENSE).
- **React Bits:** MIT com Commons Clause e restrições sobre redistribuir componentes/ports. **Aceternity:** termos próprios para seus itens, com distinções de terceiros. Não vendorizados como biblioteca de efeitos. [React Bits](https://raw.githubusercontent.com/DavidHDev/react-bits/main/LICENSE.md), [Aceternity](https://ui.aceternity.com/licence).
- **Texturelabs:** permite aplicações em vídeo, mas restringe redistribuição de originais/pacotes/templates e uso para treinamento/assistência à geração de imagem por IA. É fonte para uso específico conforme termos, não conteúdo para preencher `brand/textures` indiscriminadamente. [Termos](https://texturelabs.org/terms/).
- **Fontsource:** obter WOFF2 não torna todas as fontes MIT; conferir cada família. **GSAP:** uso comercial gratuito sob licença própria, não MIT. **Lucide:** ISC, com ícones herdados sob MIT identificados na licença. [Exemplo de fonte](https://fontsource.org/fonts/open-sans/about), [GSAP](https://gsap.com/community/standard-license/), [Lucide](https://lucide.dev/license).
- **Creative Center:** Top Ads é uma seleção de anúncios autorizados, com acesso completo condicionado a login; sua performance não estabelece uma regra de orgânico. [TikTok](https://ads.tiktok.com/help/article/top-ads?lang=en).

Uiverse, Magic UI, Motion Primitives, Material Motion, LottieFiles, Animista e outras bibliotecas de UI permanecem opções sob demanda. Antes de adotar, conferir termos do item, ganho para o vídeo e portabilidade para tempo determinístico. Hover, scroll, estado React, carregamento remoto e loops por relógio de parede não são uma timeline de vídeo. O catálogo atual, GSAP e SVG já resolvem muitas dessas funções com menos dependências.
