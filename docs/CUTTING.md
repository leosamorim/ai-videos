# Acabamento de cortes

O corte deve preservar uma unidade compreensível de fala e ação, com entrada e saída naturais para a linguagem escolhida. Remover esperas sem função, erros e sobras de gravação quando houver evidência. Preservar expressão, respiração, reação e gesto que contribuam para o conteúdo. Esse critério vale para apresentação, entrevista, tutorial, demonstração ou cena encenada; o briefing define o grau de espontaneidade e velocidade.

## Decidir pelo contexto

Uma expressão transitória durante a fala pode parecer estranha em um quadro isolado. Olhar para baixo, piscar, mudar a postura ou ficar em silêncio não identifica, por si só, um erro. Observe a sequência anterior e posterior, o que a pessoa diz e a função da ação. Não usar expressão neutra, sorriso constante ou contato visual permanente como padrão de qualidade.

| Situação observada na sequência | Direção editorial |
| --- | --- |
| Ideia concluída, seguida de consulta ao roteiro, reinício ou interação com a gravação | Remover a sobra quando não fizer parte do conteúdo; sair antes do reset, preservando a conclusão útil. |
| Olhar para um objeto, gesto demonstrativo ou reação que explica o assunto | Preservar a ação e tempo suficiente para compreendê-la. |
| Expressão isolada no meio da articulação | Avaliar em movimento; não retirar sílabas ou palavras para escolher um rosto “melhor”. |
| Hesitação ou pausa que sustenta raciocínio, emoção, humor ou contraste | Manter a função; encurtar apenas o excedente quando melhorar o ritmo. |
| Espera sem informação entre trechos já completos | Encurtar com base na continuidade visual e sonora, sem uma duração universal. |
| Intenção ambígua | Manter ou registrar a dúvida antes da decisão dependente. |

## Refinar entradas e saídas

Depois de escolher e ordenar os takes, revise as duas bordas de cada trecho. Diferencie o fim da fala útil, o fim da ação útil e o início de preparação/reset, quando existirem. A transcrição ajuda a localizar a fala, mas esses momentos podem não coincidir. Apoie a decisão nas evidências do bruto e confira o resultado montado antes de investir em gráficos.

- **Entrada:** preservar o ataque da primeira palavra e a preparação necessária para entender o gesto. Retirar preparação técnica ou espera que não comunique nada.
- **Saída:** preservar a última sílaba, a conclusão do gesto e a reação intencional. Evitar deixar no corte uma sobra evidente de consulta, reinício ou desligamento da gravação.
- **Emenda:** conferir sentido, respiração, posição/movimento e evolução da expressão de ambos os lados. Um jump cut pode ser uma escolha válida; avaliar se comunica ou parece um acidente, conforme o estilo do projeto.
- **Abertura e encerramento:** revisar também o primeiro e o último trecho, mesmo em um vídeo sem emendas internas. Considerar a conclusão sonora e o tempo de leitura de um eventual CTA.

Quando a saída visual desejada coincide com fala indispensável, prefira ajustar a borda ou usar outro take completo. Um apoio visual relevante pode cobrir a imagem enquanto a fala continua íntegra, sem alterar a sincronização da pessoa quando ela reaparece. Não presumir que o corte de áudio e vídeo possa ser separado pelo EDL atual: a execução mantém ambos no mesmo relógio; o apoio é composto sobre a fala. Zoom, congelamento ou transição não corrigem uma palavra truncada.

## Silêncio e ruído

Classifique o problema antes de processar. Ritmo mais rápido não exige eliminar toda respiração ou pausa.

| Tipo | Tratamento a considerar |
| --- | --- |
| Silêncio sem função | Encurtar após examinar a ação; conferir a junção resultante. |
| Respiração útil | Preservar; se distrair, comparar uma atenuação local com o original. |
| Estalo de boca, toque no microfone ou roupa fora da fala útil | Cortar quando houver bordas seguras ou atenuar localmente; verificar que não surgiram clicks ou buracos no ambiente. |
| Ruído sobre uma palavra necessária | Preferir outro take equivalente ou reparo localizado após escuta. Preservar inteligibilidade e timbre; não remover a palavra. |
| Ruído contínuo | Tratar separadamente da seleção de takes, apenas se demonstrado. Comparar antes/depois com nível semelhante e ouvir possíveis artefatos. |

`silences` mede energia e propõe candidatos; não identifica intenção nem a causa do som. ASR pode ajudar a detectar fala ausente, mas não comprova ausência de ruído, naturalidade ou integridade de todas as sílabas. O corte já aplica fades curtos de áudio (8 ms) nas extremidades dos segmentos. Eles não substituem revisão e não justificam acrescentar fades longos sobre consoantes. Não introduzir crossfades que encurtem a timeline ou somem falas sem recalcular e verificar relógios e âncoras.

## Inspeção proporcional e rastreável

1. No bruto, use `inspect SLUG --from S --to E --every 0.1` nas bordas duvidosas e em descartes de não atuação. Abra o clip/folhas realmente gerados. Essas imagens são amostradas; não são todos os quadros. Os tempos de `inspect` pertencem ao bruto.
2. No corte montado, `frames SLUG --clean --cuts` localiza abertura (`start`), emendas (`c01`, `c02`…) e encerramento (`end`). É um resumo estático, insuficiente para julgar evolução de expressão ou movimento.
3. Examine cada borda em reprodução normal com áudio quando disponível. Sem reprodução contínua, use `frames SLUG --clean --cuts --context 0.5` para obter quadros consecutivos. `--context` é tempo de inspeção de cada lado, limitado ao vídeo; **não é padding de corte**. Amplie a janela quando a ação exigir contexto. `--boundary c01` limita o trabalho a uma emenda; `start` e `end` também são aceitos. Sequências sobrepostas podem repetir quadros com rótulos distintos.
4. Registre por borda a evidência aberta, método, observação visual/sonora, decisão e motivo. A tabela gerada em `02-cut/CUT-REVIEW.md` serve como roteiro de inspeção. Nas revisões finais, faça o registro em `review.json` → `checks.seams.notes` ou referencie ali um relatório local vinculado ao hash do render. Uma observação específica pode ser curta; “todos os cortes bons” não explica o que foi examinado.
5. Se modificar uma borda, regenere os derivados afetados e reexamine a emenda. No render de entrega, repita a inspeção usando `--file CAMINHO` ou o último render (sem `--clean`); gráficos e som podem alterar o resultado. Evidência do proxy não aprova o master. Reaproveite inspeção anterior apenas conforme o contrato de [revisão incremental](EFFICIENCY.md).

Exemplo de registro, apenas para mostrar a estrutura: `c02, saída 8,4 s: sequência X aberta; a demonstração termina antes da emenda e a frase seguinte começa sem salto de ação. Manter. Método: quadros consecutivos; áudio não ouvido, integridade sonora não confirmada.` Quando houver escuta, registre o trecho ouvido e o que ela permitiu concluir. Gerar um arquivo não significa examiná-lo.

A extração reutiliza folhas íntegras por hash e oferece inspeção de uma borda por vez, evitando reabrir o vídeo inteiro para um ajuste localizado. O limite de 2000 quadros por chamada pede divisão por borda; não autoriza pular bordas ou espaçar amostras para julgar movimento. O vídeo selecionado precisa manter o relógio da EDL. Para materiais externos ou outro timing, use intervalos explícitos de `--seq`.

O mecanismo valida evidências, tempos e observações gerais existentes. A tabela de acabamento é uma obrigação de revisão do agente, não um detector automático de expressões ou um novo schema de aprovação. Projetos e aprovações antigas não são reescritos ao atualizar o repo. Ao retomar uma edição, aplique esses critérios ao escopo revisado e declare qualquer limitação que impeça confirmar som ou intenção.
