# Composição: técnicas conferidas e armadilhas

Notas de implementação em HyperFrames/GSAP que saíram de edições reais neste workspace e foram conferidas em render. São ferramentas para quando a edição pedir. Nenhuma é padrão, e nenhuma cor, fonte ou ritmo faz parte delas. O que mostrar e por quê está em [CRAFT.md](CRAFT.md); o contrato do motor, nas skills `hyperframes-*`.

Projetos locais anteriores podem ter um script em `videos/<slug>/tools/` com tudo isto aplicado. Sirva-se da mecânica; o visual ali pertence àquela marca e àquele pedido.

## Montar a composição por script

Quando a composição tem muitos elementos ou vai ser refeita várias vezes, um script no projeto (`tools/`) que escreve em um `index.html` recém-criado torna cada revisão reproduzível:

```bash
rm videos/SLUG/04-composition/index.html
node scripts/vid.mjs compose SLUG        # recria o HTML a partir do template
python3 videos/SLUG/tools/build.py       # insere CSS, marcação e animação
node scripts/vid.mjs compose SLUG        # atualiza tempos gerenciados e legendas
node scripts/vid.mjs check SLUG && node scripts/vid.mjs render SLUG --quality looks
```

- O template tem `<!-- CARDS:START -->`/`<!-- CARDS:END -->` para a marcação e um comentário fixo no `<script>` para a animação. O script deve falhar se o arquivo já foi montado, em vez de inserir duas vezes.
- Tempos de card vêm de `03-plan/resolved.json`; instantes dentro de um card (uma ação na palavra exata) vêm de `02-cut/transcript.json` por `source_i` e `segment_id`. Nenhum segundo escrito à mão: mudar o storyboard e rodar de novo basta.
- `compose` reescreve `data-start`/`data-duration` do primeiro elemento cujo `id` é o id do card. Dê esse id ao elemento temporizado.
- `captions.config.json` tem precedência sobre `theme.captions` e nasce com `y` em 70% da altura, mesmo que o tema diga outra coisa. Para mudar a altura da legenda, edite o config (o script pode fazer isso).
- `emphasis`, `phraseStarts` e `underline` são índices de palavras daquele vídeo. Um tema copiado de outro projeto precisa dessas listas vazias.

## Movimento sobre a fala

`#video-wrap` pertence aos reenquadramentos do storyboard. Para outro movimento na mesma imagem (avanço lento contínuo, passagem para um apoio), envolva `#video-wrap` em elementos sem tempo e anime cada um com uma função só. Dois controladores no mesmo elemento brigam pela mesma propriedade.

Vários tweens da mesma propriedade no mesmo elemento, em momentos diferentes, precisam de `immediateRender: false` nos `fromTo` (ou `set` seguido de `to`). Sem isso, o último `from` criado vale no tempo zero.

`filter: blur()` e `scale` num invólucro do `<video>` renderizam normalmente, assim como `mix-blend-mode` e transformações 3D com `perspective`. Mantenha a passagem com desfoque curta (cerca de 5 quadros) e em um invólucro próprio, separado do zoom lento.

## Traço que se desenha

Com `pathLength="1"` e `stroke-dasharray="1"`, anima-se `strokeDashoffset` de 1 a 0.

- Passe `autoRound: false`. O GSAP arredonda valores em px para inteiro: sem a opção o traço fica invisível até a metade da duração e surge inteiro de uma vez. O defeito não aparece em quadros espaçados; passou por duas entregas antes de ser visto em quadros consecutivos.
- O padrão de traço recomeça a cada subcaminho. Haste e ponta de uma seta num mesmo `d` nascem juntas; use dois caminhos e comece a ponta quando a haste termina.
- Para revelar muitos traços curtos em sequência (marcas de uma régua, uma grade), abra uma janela com `overflow: hidden` em vez de animar o traço.
- Linha "que ferve": três cópias do caminho com os pontos deslocados 1 a 2 px, alternadas por `tl.set` a cada poucos quadros. Gere os deslocamentos com semente fixa, por ponto e não por ordem, para pontos compartilhados entre caminhos coincidirem.

## Foco seletivo numa foto

Uma cópia desfocada e mais escura, gerada antes com FFmpeg (`gblur`, `eq`), fica sobre a foto nítida com um furo no objeto: `clip-path: polygon(evenodd, <retângulo externo>, <contorno do objeto>)`. A opacidade da cópia sobe em meio segundo. Custa menos que animar `filter` no quadro inteiro e é igual em todo render.

## Dois estados da mesma cena

Duas imagens com a mesma câmera (fechado/aberto, antes/depois) permitem animar a parte que muda em vez de fundir uma na outra:

1. Meça os quatro cantos da parte móvel nos dois estados, em pixels do quadro, com uma grade sobre a imagem.
2. Retifique a parte móvel do primeiro estado para um retângulo com o filtro `perspective` do FFmpeg (`sense=source`).
3. Posicione o retângulo em 3D no eixo de giro. A razão entre as alturas das duas bordas dá a profundidade de cada borda; com as posições horizontais, saem a distância de `perspective`, a largura real e os ângulos inicial e final.
4. Mostre o elemento 3D só enquanto ele se move: antes, a primeira imagem está intacta; no fim, funda para a segunda e esconda o elemento.

Confira com quadros consecutivos se o elemento parte de cima do primeiro estado e pousa sobre o segundo.

## Vídeo de apoio

- Um `<video data-start>` não pode ficar dentro de outro elemento com `data-start` (o lint recusa e o quadro mostrado sairia errado). Ponha o vídeo numa camada sem tempo e mostre/esconda a camada pela timeline. O próprio `<video>` leva o id do card.
- Prepare o arquivo antes: recorte na ação, sem áudio (`-an`), velocidade ajustada com `setpts` se a ação não couber na frase. Quadros não dizem se um clipe acelerado ainda parece natural; avise na entrega quando mexer na velocidade.
- Para a ação cair numa palavra, meça nos quadros do clipe quando ela começa e use `data-media-start = início_da_ação − (instante_da_palavra − início_do_card)`.
- O áudio do clipe só entra se for parte da ideia e alguém o tiver ouvido.

## Textura e peso do arquivo

Grão: uma imagem de ruído cinza com `mix-blend-mode: overlay`, deslocada por `tl.set` a cada dois quadros com uma lista fixa de posições (nada de `Math.random` em tempo de render). A intensidade só se avalia num recorte a 100%. Na edição em que entrou junto com mais movimento, o arquivo final passou de 43 para 95 MB em CRF 16; o grão é o principal suspeito, não medido isoladamente.

## Efeitos sonoros

- Meça uma vez, por arquivo, o pico e o instante em que o som de fato começa. Início na timeline = instante do evento − ataque ÷ fator de altura; ganho = pico desejado − pico medido.
- Altura diferente do mesmo arquivo: `asetrate` seguido de `aresample`.
- Todo `<audio>` precisa de `id`. Distribua os efeitos em faixas livres no instante de início; a faixa das legendas não recebe áudio.
- Acrescentar elementos de áudio mudou o nível de toda a mixagem por igual (1,2 dB com dois a mais, causa não investigada). Compare a relação entre voz e efeitos, não o valor absoluto; `finalize` normaliza o conjunto.

## Conteúdo perto da base

A faixa de baixo do quadro é disputada pela legenda e pela interface das plataformas. Se o que importa numa imagem está ali, marque outra parte do mesmo objeto que esteja livre, ou mova a legenda com `caption_zones` enquanto a imagem durar.

## Conferir sem assistir

| O que | Como |
| --- | --- |
| Posição e legibilidade antes de renderizar | `vid snapshot SLUG --at 3,7.2`: instantes isolados, gravados em `06-review/snapshots/` |
| Cada elemento animado, no render | `vid frames SLUG --seq 12.0-12.7`: quadros consecutivos; `--step N` para intervalos longos |
| Detalhe pequeno (grão, sublinhado, ponta de seta) | `--crop x,y,largura,altura`, em pixels do vídeo |
| Emendas e voltas para a fala | `vid frames SLUG --cuts`, mais uma sequência em torno de cada volta |
| Som encobrindo a voz | `vid verify SLUG --speech` e comparar as diferenças com as do render anterior: as que já existiam são do reconhecedor |

`vid check` vem imediatamente antes de `vid render`; qualquer arquivo novo na composição entre os dois invalida a validação (a pasta `snapshots/` é a exceção). Quadros não mostram ritmo, e medições não mostram se o som agrada: dizer isso na entrega continua obrigatório.
