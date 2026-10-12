# Verificação da versão 0.2.0

Executada localmente em 2026-10-12, no Linux, com FFmpeg n9.0.1, HyperFrames 0.8.145 e GSAP 3.15.0.

| Verificação | Resultado |
| --- | --- |
| Testes de núcleo, mídia, cache, distribuição e fluxo | 48 aprovados; executados com Node 26.8.1 e também Node 22.23.3 |
| Sintaxe do código original JavaScript | 48 arquivos válidos |
| Espelho de skills | 20 skills, sem links divergentes |
| Skills editoriais alteradas | `video-edit`, `video-editorial` e `video-review` aprovadas no validador de estrutura |
| Render real HyperFrames | Prévia proxy/draft e master/looks; check, verify, review, diff e finalize aprovados em fonte sintética |
| Render na cópia pública, com Node 22 | Aprovado sem marca, projetos ou mídia privada do workspace |
| Arquivo sintético de entrega | 1080×1920, 30 fps, 72 quadros, 2,4 s, áudio AAC; verificação técnica sem erros |
| Publicação | Auditoria da lista pública, rejeição de material privado forçado no índice e export com manifesto de hashes |
| Documentação própria | Links locais conferidos |

O teste de render inclui entrada, traço, aproximação e clique. Os testes GSAP verificam poses intermediárias e seeks em ambos os sentidos. O diff é exercitado com mudanças reais em dois quadros, mudança somente de áudio e incompatibilidade de tempo/cor. A correção de palavras exige nova validação editorial mesmo quando o master pode ser reutilizado.

Os testes usam observações sintéticas para exercitar os contratos de revisão. Não comprovam qualidade artística, resultado de marketing ou percentual de economia na assinatura. Não foi feita nova edição de material do usuário como parte dessa implementação. A configuração de CI foi incluída; sua execução no GitHub ocorrerá após publicar o repositório.

## Adição da orientação de primeiro uso

Verificada em 2026-10-12 com `npm run validate`: 52 testes aprovados, 51 arquivos JavaScript com sintaxe válida e 20 skills sincronizadas. `video-edit` também passou no validador de estrutura. Os novos testes exercitam um workspace vazio sem dependências instaladas, projetos existentes e vinculados, consulta sem gravação, registro explícito sem repetição, releitura e registro inválido. O teste de distribuição confirma que `.local/welcome.json` fica fora da cópia pública. Os testes de mídia continuam passando; esta alteração não muda composição ou render e não exigiu novo render HyperFrames.
