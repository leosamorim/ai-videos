# Direção de edição para conteúdo orgânico

A camada de estratégia conecta **objetivo → público → promessa → evidência → decisões de edição → próximo passo → aprendizado**. `video-edit` continua coordenando o projeto; [video-strategy](../.claude/skills/video-strategy/SKILL.md) fornece os critérios de direção. Não há motor adicional nem pontuação automática de potencial viral.

Foi incorporado conhecimento selecionado dos seis repositórios sugeridos e de fontes primárias do Instagram/TikTok. A [auditoria de fontes](../.claude/skills/video-strategy/references/sources.md) inclui commits, adoção observada, licenças e recomendações rejeitadas. Para decidir a montagem, leia a [matriz de objetivos e critérios editoriais](../.claude/skills/video-strategy/references/direction.md). Para adaptação e métricas, consulte [plataformas e aprendizado](../.claude/skills/video-strategy/references/platforms-and-learning.md).

## Uso no fluxo

Em uma edição orgânica nova, o agente esboça a intenção antes de escolher takes e a confirma depois de examinar fala e vídeo. Materiais de referência continuam entrando pelo comando `reference`, com seus papéis existentes. Um site pode fundamentar posicionamento, tema e linguagem, mas não comprova o comportamento da audiência.

```bash
node scripts/vid.mjs strategy meu-projeto --init
# O agente preenche strategy.json a partir do briefing e das evidências.
node scripts/vid.mjs strategy meu-projeto
# Após selecionar e executar o corte, preencher os beats do storyboard.
node scripts/vid.mjs plan meu-projeto
```

`--init` preserva arquivos existentes. O arquivo vazio não é uma estratégia aprovada: precisa ser preenchido. Não há um novo portão de aprovação; vale a política de revisão já escolhida. O usuário não precisa preencher um formulário: o agente reutiliza informações fornecidas, registra suposições e pergunta só o que muda uma decisão relevante.

Em trabalhos só de legenda ou mudanças técnicas locais, não é necessário ativar essa camada. Projetos existentes sem `strategy.json` continuam compatíveis. A adoção em um projeto existente é explícita; criar o arquivo torna obrigatórias sua validação em `plan` e sua revisão no render.

## Contrato de `strategy.json`

Veja o [exemplo fictício completo](../templates/strategy.example.json). Ele demonstra o formato; não é evidência de um projeto real e não deve ser copiado como se fosse uma análise do bruto.

| Campo | Conteúdo |
| --- | --- |
| `schema` | `1` |
| `objective` | Uma prioridade: `discovery`, `education`, `trust`, `community` ou `conversion` |
| `business_outcome` | Resultado que interessa à marca, distinguido da métrica do post |
| `audience` | `who`, `situation`, `desired_change`: quem, em qual situação e que mudança se busca |
| `promise`, `payoff` | O que a abertura promete e o que efetivamente entrega |
| `hook` | `spoken`, `visual`, `on_screen`, `why`. Canais não utilizados ficam vazios; pelo menos um é usado |
| `evidence[]` | `id`, `kind` (`footage`, `reference`, `brief`), `source`, `observation`. Fonte local/URL, IDs de referência ou intervalo/palavras e método de inspeção que permitam conferir a observação |
| `beats[]` | `id`, `role`, `viewer_need`, `decision`, `evidence_ids`. Papéis: `hook`, `context`, `explanation`, `proof`, `payoff`, `cta` |
| `cta` | `action`: `follow`, `save`, `share`, `comment`, `visit`, `contact`, `none`, `other`; `copy` e `why`. Sem ação, `copy` pode ficar vazio |
| `platforms[]` | Uma entrada por destino: `platform` (`instagram`, `tiktok`, `youtube-shorts`, `other`), `discovery`, `adaptation`, `primary_metric` |
| `primary_metric` | `name`, `definition`, `denominator`, `window`; esclarecer unidade e atribuição na definição, ou “não se aplica” para denominador de contagem absoluta |
| `assumptions[]` | Hipóteses sem comprovação; lista vazia quando não houver |
| `guardrails[]` | Pelo menos um limite editorial relevante: verdade, clareza, voz da marca ou ação qualificada |

O validador exige abertura e payoff; exige beat de CTA quando uma ação é escolhida. Não exige uma quantidade de efeitos, duração de gancho, ordem linear de papéis ou taxa mínima de cortes. O payoff pode aparecer cedo; beats podem se sobrepor. Cada evidência e beat tem ID único. Nenhum campo textual comprova sozinho uma alegação: o agente precisa examinar a fonte e conferir o render.

## Conectar ao storyboard

Em `03-plan/storyboard.json`, `beats` recebe **os mesmos IDs** da estratégia, agora com `purpose` e tempo. Para fala, use `anchor` como nos cards. Para gestos sem fala, use `start`/`end` no relógio editado e explique o motivo. Os tempos abaixo são apenas ilustrativos para uma peça de pelo menos 12 segundos:

```json
{
  "beats": [
    {"id":"b-hook", "purpose":"Tornar a dúvida reconhecível", "start":0, "end":2},
    {"id":"b-payoff", "purpose":"Ver a tabela voltar ao estado anterior", "start":2, "end":10},
    {"id":"b-cta", "purpose":"Indicar o valor recorrente do perfil", "start":9, "end":12}
  ],
  "cards": [
    {"id":"filter-label", "beat_id":"b-payoff", "purpose":"Localizar o controle usado", "start":3, "end":5}
  ],
  "reframes": []
}
```

Um beat sem card/reframe é válido: demonstração contínua também é direção intencional. Quando há `strategy.json`, cards e reframes precisam de `beat_id` existente e alguma sobreposição temporal com ele. Zonas de legenda e correções técnicas não precisam de justificativa de marketing artificial. Elementos podem servir a mais de uma função; registre o vínculo principal e explique os demais no propósito.

`vid plan` resolve âncoras, rejeita payoff cuja palavra foi removida e valida o mapa de beats. `03-plan/resolved.json` registra o hash da estratégia. A composição recebe os beats resolvidos em `window.editorialTimeline.beats`, mas eles não desenham elementos automaticamente. O agente continua responsável por ligar observação a desenho e por perceber se a seleção de takes ainda entrega o prometido.

## Mudanças e revisão

Adicionar, alterar ou remover `strategy.json` invalida storyboard, composição, revisão e entrega. Não exige retranscrição nem refazer análise da mesma fonte. O corte permanece como material disponível: se a nova intenção mudar a seleção necessária, o agente deve revisar `edit-plan.json` e executar o corte novamente. O validador não julga sozinho a adequação semântica do material mantido.

`vid review` inclui `checks.strategy` quando a camada está ativa e vincula a revisão ao hash da estratégia. Registre, no render exato: onde a promessa foi cumprida; se a prova teve tempo legível; se abertura, fala e texto são coerentes; se os efeitos ajudam; se o CTA respeita o objetivo e a preferência do usuário. Uma mudança de estratégia exige nova revisão mesmo se os bytes do vídeo forem idênticos.

## Aprender depois de publicar

Não há publicação, coleta em conta nem escolha automática de vencedor. Quando o usuário fornecer Insights/exportações, o agente preenche `06-review/learning.md` seguindo o [guia de aprendizado](../.claude/skills/video-strategy/references/platforms-and-learning.md). O arquivo registra post/versão, números, janela, coorte, hipóteses alternativas e próximo teste. Não faz parte do fingerprint da produção: acrescentar resultados não torna um vídeo tecnicamente obsoleto.

A métrica prioritária deve corresponder ao objetivo. Retenção serve para localizar problemas; envios podem indicar circulação; salvamentos podem indicar utilidade futura. Nenhum desses sinais, sozinho, demonstra confiança, aprendizado ou vendas. O próximo corte nasce de uma hipótese verificável, com limites explícitos, e não de uma receita universal de viralização.
