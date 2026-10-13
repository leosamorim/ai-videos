# Primitivas reutilizáveis de movimento

`templates/components/motion.js` é copiado pelo `compose` e carregado no template novo. Em uma composição autoral já existente, inclua `assets/vendor/motion.js` explicitamente para usar os helpers. Eles não alteram paleta, fonte, direção criativa ou seleção de cenas.

| Helper | Uso e parâmetros adicionais |
| --- | --- |
| `VidMotion.enter(tl, elemento, opções)` | Entrada discreta: `distance` em pixels |
| `VidMotion.punch(tl, wrapper, opções)` | Reenquadramento no wrapper: `from`, `to`, `origin`; nunca no `<video>` |
| `VidMotion.draw(tl, pathSVG, opções)` | Traço revelado: `length` medido do path; pode usar SVG com `pathLength="1"` e `length: 1` |
| `VidMotion.click(tl, alvos, opções)` | Cursor, pressão/retorno do botão e troca de rótulo; `fromX`, `fromY`; alvos `{button,cursor,label,doneLabel}` |

Todas as opções incluem `{id, start, duration}` em segundos da timeline editada. Cada chamada retorna `{id, kind, start, end}` para compor o `motion-plan.json`. Esses valores precisam vir das âncoras compiladas do storyboard. Inclua também movimentos implementados fora dos helpers no mapa de revisão.

`click` também aceita `{id, hit, duration}`: calcula `start` para manter o contato do cursor no evento compartilhado com o som. Se `start` e `hit` forem informados juntos, precisam concordar. Retorna `markers: {hit, pressed, settled, end}`; `hit` é contato, `pressed` é o fim da pressão/troca de rótulo. Leia [CHOREOGRAPHY.md](CHOREOGRAPHY.md) para declarar eventos e cues no storyboard. `draw` desliga arredondamento CSS para revelar continuamente até paths normalizados com comprimento 1.

```js
const event = VidMotion.click(tl, {
  button: '#follow-button', cursor: '#cursor',
  label: '#follow-label', doneLabel: '#following-label'
}, {id: 'follow-click', start: 12, duration: 0.8});
```

Posicione os elementos em CSS e mantenha os textos legíveis. O cursor termina na origem CSS do alvo, portanto alinhe-o visualmente ao botão. Os helpers usam somente a timeline GSAP pausada; não têm timers, aleatoriedade ou callbacks de reprodução. Declare a timeline no contrato HyperFrames.

Os estados de base são aplicados explicitamente na construção da timeline, inclusive no instante zero. Apenas chamar `seek(0)` numa timeline nova pode não avaliar seus `set`s; o mesmo quadro precisa ser igual ao voltar do fim. Entradas `fromTo` continuam com `immediateRender: false` para não antecipar animações futuras. Construir os helpers antes de iniciar a inspeção/reprodução.

Não empilhe dois helpers que disputem a mesma propriedade ao mesmo tempo. Separe movimento de câmera, entrada de card e animação interna em wrappers. Teste seeks para frente e para trás; confira animações com quadros consecutivos do render exato. Os helpers reduzem retrabalho técnico, mas não escolhem o efeito editorialmente apropriado.
