# Edição com intenção

Para fala explicativa, começar pela pessoa e pelo objeto explicado. A edição deve acrescentar informação, organizar atenção ou resolver uma emenda. Uma pausa útil, um gesto e uma mudança de expressão podem comunicar mais que outro título.

Antes dos gráficos, aplicar o [acabamento de cortes](CUTTING.md): revisar entradas e saídas de fala/ação, classificar pausas e ruídos, conferir abertura, emendas e encerramento com contexto temporal. A intenção da sequência orienta o corte; uma expressão isolada ou um desvio de olhar não estabelece um erro.

Antes de desenhar um card, escrever qual informação visual ele acrescenta à fala e à legenda. Se apenas repetir ambas, experimentar removê-lo no animatic. Deixar trechos de fala sem novos elementos para recuperar o rosto e os gestos. A quantidade depende do material, sem cota obrigatória de cortes, zooms, efeitos ou palavras destacadas.

Usar as fotos do usuário para mostrar o objeto real. Uma linha pode localizar uma porta; uma cota numérica sobre ela afirma uma medida daquele objeto. Só desenhar a cota se houver evidência dessa medida. Não transformar uma opinião da fala em garantia técnica no gráfico. Preservar condicionais como “se possível”. Uma imagem de apoio pode substituir a tela inteira, evitando cobrir parte do rosto com um card.

Antes de fixar quanto tempo um apoio fica na tela, ler a frase que toca por baixo dele e ver de quem ela fala. O apoio sai quando o sujeito da frase muda: a imagem da alternativa descartada sob uma frase que elogia a solução escolhida inverte o sentido para quem está sem som ou distraído. Quando a fala compara duas coisas, considerar as duas no mesmo quadro, a segunda entrando no instante em que é nomeada, em vez de uma substituir a outra.

Uma anotação sobre a imagem descreve o que está visível nela (onde fica, qual parte, em que ordem) e pode preparar a frase seguinte; a conclusão continua com quem fala. Imagem gerada por IA entra identificada como ilustração e sem medida. Material de terceiros sem origem informada pode ser usado a pedido do usuário, com o direito de uso registrado como pendência e dito na entrega.

Apoio com resolução menor que o quadro funciona melhor perto do tamanho original, como janela, cartão ou cópia sobre outro fundo, do que ampliado para a tela inteira. Se a ampliação for inevitável, conferir um quadro a 100% ao lado das outras imagens antes de decidir.

Legendas: mostrar unidades de sentido, com bom contraste desde a primeira palavra. Evitar animação em cada bloco e mudança de cor em cada palavra por hábito. Usar `highlightMode: "none"` para leitura estável ou `"selected"` e `emphasis` para poucos destaques escolhidos. As referências são `source_i` ou `{source_i, segment_id}`; `phraseStarts` ajusta quebras sem reescrever a fala. Referências removidas/ambíguas causam erro, para uma alteração no corte não deslocar silenciosamente a decisão editorial.

`06-review/captions.json` lista texto, origem, duração e velocidade. Blocos menores que 0,65 s e acima de 22 caracteres/s são sinais locais para revisão, não normas universais nem reprovação automática. Ajustar agrupamento, tamanho e linha após ver o quadro em escala de celular. Não alongar texto sobre a frase seguinte só para melhorar uma métrica.

Movimento: cada movimento precisa de uma função que caiba em uma frase, como levar o olhar a um ponto, ligar um plano ao seguinte ou tirar a rigidez de uma imagem parada. O que não tem função sai. Cortes do mesmo tipo pedem a mesma passagem; elementos de papéis diferentes (título, imagem, anotação, legenda) podem entrar de modos diferentes, desde que cada papel entre sempre do mesmo modo. Isso é coerência dentro de uma peça, não um conjunto fixo de efeitos para todas.

Transições: examinar entrada, meio, saída e as bordas entre imagens. Evitar flashes da apresentadora entre dois apoios consecutivos, fundos vazios e cortes que escondam o gesto explicado. Uma imagem estável pode ser a melhor escolha. Reenquadrar para uma finalidade concreta, com espaço para mãos e rosto.

Para coreografar gráficos, consultar [CHOREOGRAPHY.md](CHOREOGRAPHY.md): escolher o que conduz cada beat, ordenar a atenção e reservar tempo útil de leitura. Os eventos compartilhados do storyboard ligam ação visual e som; cotas de camadas/movimentos dos exemplos técnicos não substituem o julgamento editorial.

CTA: um convite legível associado à fala e ao perfil correto basta. Uma simulação de botão clicado não corresponde a uma ação real da pessoa assistindo. Usá-la somente quando essa encenação fizer parte do conceito pedido.

Som: conservar o timbre e a respiração úteis. Trilha deve ter autoria/licença registradas e nível medido relativo à voz; decidir ducking/EQ pela competição real. Medidas e ASR não comprovam agrado, naturalidade ou escuta. Relatar a revisão efetivamente feita. Efeito sonoro acompanha um evento que se vê, alinhado pelo ataque do som e não pelo início do arquivo; eventos aparentados podem usar o mesmo som em alturas diferentes. Se o usuário vai colocar a própria trilha, entregar sem trilha e avisar que o nível dos efeitos foi definido sem ela.

Memória de gosto: manter no projeto decisões e suas evidências. Distinguir preferência expressa pelo usuário de hipótese editorial do agente e resultado de teste. Só promover uma hipótese a padrão de marca depois de feedback; uma edição isolada não estabelece a preferência de todos os próximos vídeos. O que foi aprovado vale para aquela marca e aquele tipo de peça: fica em `brand/` e na memória de referências, com a frase do usuário, e não nas regras gerais deste documento.

Mudança de direção, diferente de um ajuste, começa guardando a versão atual inteira (`07-versions/` no projeto), para comparar e voltar. Como implementar movimento, apoio em vídeo, textura e som na composição, e como conferir cada um: [COMPOSITION.md](COMPOSITION.md).
