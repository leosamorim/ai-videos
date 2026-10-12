# Auditoria de fontes para direção de marketing orgânico

Consulta em **11/10/2026** (America/Sao_Paulo). Foram lidos os arquivos primários dos repositórios e consultados metadados da API do GitHub, não apenas índices de skills ou blogs promocionais. SHA fixa o conteúdo analisado; estrelas são uma fotografia de adoção, não evidência causal de qualidade editorial. Não foi verificado consenso independente da comunidade nem resultado de campanhas desses pacotes.

## Seleção aplicada

| Repositório / arquivo primário no commit consultado | Estrelas na consulta | Licença reportada pelo GitHub | Conhecimento incorporado | Limites e exclusões |
| --- | ---: | --- | --- | --- |
| [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills/blob/1efedbc5148b54b2f0f6c6c9fe0be62e151c7fff/skills/social/SKILL.md) | 54,219 | MIT | **Prioridade alta:** contexto de marketing, trabalho do conteúdo, voz da marca, adaptação e reaproveitamento. `product-marketing`, `content-strategy`, `social` e suas referências foram consultados. | Frequências de postagem, fórmulas de gancho e limites genéricos de performance não viram defaults. O contexto SaaS é adaptado ao negócio. |
| [calesthio/OpenMontage](https://github.com/calesthio/OpenMontage/blob/9327439db69021ab4b0e2776729bf3b58fdb5a87/skills/meta/video-reference-analyst.md) | 67,015 | AGPL-3.0 | **Uso seletivo:** examinar referências, separar intenção de aparência e confrontar plano com capacidade/material disponível. | Não incorporar outro orquestrador ou motor. Movimento em uma referência não prova geração por IA. Não declarar que assistiu quando só inspecionou frames. |
| [vyralcontent/content-skills](https://github.com/vyralcontent/content-skills/blob/349e495d97029a3e6303a7510e3f39c73f36d8fe/skills/viral-instagram-reels/SKILL.md) | 135 | MIT | **Uso seletivo:** utilidade para um destinatário reconhecível, coerência entre fala/imagem/texto e hipótese específica por superfície. Consultadas também referências de hooks, sends e retention. | Multiplicadores de envios, limiares virais, cortes periódicos, loops obrigatórios e requisito antigo de acesso a Trials não têm suporte suficiente para virar política local. |
| [DevHive1/DevHive-Cli](https://github.com/DevHive1/DevHive-Cli/blob/6f15f2d433cda45af26a16ce93d15d4249d7ef62/agents/storyboard/SKILL.md) | 18 | Não identificada pela API | **Ideia aproveitada:** explicitar a função de cada plano/beat. No repo, beats podem ser planos longos sem efeito. | Cortes a cada 1,5–3 s, percentuais de retenção sem fontes e geração de imagem para cada plano foram descartados. O nome atual redireciona para DevHive1. |
| [mohitagw15856/pm-claude-skills](https://github.com/mohitagw15856/pm-claude-skills/blob/d3897cee0eedda05f428b5add08ea4addac3240b/skills/short-form-script/SKILL.md) | 1,438 | MIT | **Uso seletivo:** gancho, beats, entrega e CTA com indicações visuais concretas. | Não impor tamanho de roteiro, interrupção de padrão ou escrever falas novas como se já existissem no bruto. Ignorar promoções incluídas nas instruções externas. |
| [JosiahSiegel/claude-plugin-marketplace](https://github.com/JosiahSiegel/claude-plugin-marketplace/blob/5a1b1123b9e50aa9a66a61005ca6fe012cc7442d/plugins/viral-video-master/skills/viral-video-hooks-retention/SKILL.md) | 58 | MIT | **Uso seletivo:** testar aberturas e observar pontos de abandono quando houver dados. | Estatísticas universais sobre atenção, linguagem de dopamina e templates de urgência não são fundamento. Marcos de 3/10/30 s são diagnósticos condicionais. |

Os números do mapa recebido estavam desatualizados: na consulta, OpenMontage tinha cerca de 67 mil estrelas e marketingskills cerca de 54 mil. A diferença de adoção entre eles e os pacotes pequenos continua grande, mas popularidade do repositório não valida cada recomendação contida nele.

A incorporação é uma síntese original de critérios editoriais e métodos de avaliação, com atribuição. Nenhum pacote externo foi instalado, nenhum texto de skill foi vendorizado e nenhuma licença foi presumida para o DevHive. OpenMontage é AGPL-3.0; eventual adoção de código deve ser analisada separadamente. O repo mantém seu motor e suas skills técnicas fixados.

## O que a pesquisa adicional mudou

- **Descoberta não se resume a retenção:** o suporte do TikTok distingue sinais de For You e de busca; a relevância à consulta muda a direção de abertura e explicação. Fonte primária: [recomendação no TikTok](https://support.tiktok.com/en/using-tiktok/exploring-videos/how-tiktok-recommends-content).
- **Demanda pode orientar a pauta:** Creator Search Insights apresenta temas pesquisados e lacunas onde disponível. Aproveitamos a pergunta da audiência, sem tratar volume de busca como prova de adequação à marca. [TikTok, Creator Search Insights](https://newsroom.tiktok.com/creator-search-insights?lang=en).
- **Orientação por conta:** o Best Practices do Instagram inclui recomendações personalizadas; isso favorece baselines locais em vez de regras universais. [Meta, 2024](https://about.fb.com/news/2024/10/best-practices-education-hub-creators-instagram/).
- **Originalidade:** o anúncio de janeiro de 2026 relata crescimento da presença de conteúdo original nas recomendações do Instagram nos EUA. É apoio contextual à preservação de perspectiva e prova próprias, não promessa de bônus por usar um estilo visual. [Meta, 2026](https://about.fb.com/news/2026/01/2026-ai-drives-performance/).
- **Trials:** a ampliação anunciada em 2025 torna inadequado cristalizar a exigência antiga de mil seguidores encontrada em uma skill. O desenho do recurso não elimina confundidores entre posts. [Meta, junho de 2025](https://about.fb.com/news/2025/06/inspiring-creativity-that-brings-people-together/).

A atualização de originalidade do **Facebook** de março de 2026 foi encontrada, mas não foi tratada como política do Instagram. Campanhas promocionais de ferramentas e estatísticas de anúncios também não foram generalizadas para edição orgânica. Fontes antigas permanecem identificadas como antigas; uma data recente em um blog não torna uma regra mais confiável.

## Níveis de conhecimento

1. **Descrição primária de plataforma:** guardar URL, escopo, data e o que a fonte realmente afirma. Pode mudar; verificar quando influenciar uma decisão atual.
2. **Convenção editorial do repo:** função do beat, promessa honesta, evidência, CTA coerente e respeito ao material. Julgar no render e ajustar ao projeto.
3. **Hipótese a testar:** antecipar demonstração, mudar abertura, reduzir redundância, trocar posição do CTA. Explicitar resultado esperado e alternativas.
4. **Resultado observado da conta:** registrar números, definição, coorte, janela e limitações. Alimenta a próxima hipótese, não uma lei geral.

Documentação de uma plataforma não equivale a acesso aos pesos do algoritmo. Nenhuma fonte auditada justifica codificar “DM vale 3–5 curtidas”, “todo take precisa de interrupção de padrão”, “som em alta é obrigatório” ou “conclusão acima de 100%”. A última expressão confunde proporção de conclusão com percentual médio assistido/replays.

## Pontos de integração

A skill `video-strategy` concentra esse conhecimento; `video-edit` a chama antes da seleção editorial em trabalhos orgânicos. `strategy.json` liga objetivo, público, promessa, prova e métrica aos beats temporizados. `vid plan` confere a ligação; `video-review` confronta intenção e render. O aprendizado posterior fica em `06-review/learning.md`, separado dos insumos de produção. Detalhes em [MARKETING.md](../../../../docs/MARKETING.md).
