# Compatibilidade e adoção

Projetos existentes permanecem em schema 2. Não há migração em massa, retranscrição automática, troca de engine ou conversão dos vídeos já produzidos.

O [acabamento de cortes](CUTTING.md) usa os schemas atuais. `frames --cuts` passa a incluir abertura/encerramento e a selecionar índices exatos; `--context` e `--boundary` são opcionais. `cut` gera a tabela de inspeção quando for executado, sem preencher observações ou aprovar automaticamente. Artefatos e revisões existentes não são alterados só pela atualização do mecanismo.

`vid resume` lê os arquivos e calcula o estado em memória, sem gravar `project.json`. Os demais comandos mantêm o comportamento de detectar mudanças e invalidar revisões dependentes.

Os caches novos são preenchidos quando a operação correspondente é executada. Artefatos antigos sem manifesto não são presumidos válidos para compartilhar entre projetos; a primeira execução pode recalcular a mídia. O plano editorial conserva a assinatura da transcrição e precisa ser revisto quando ela muda. Dados de observações não são convertidos em aprovação humana.

`compose` continua usando master por padrão, preservando chamadas antigas. Adote `--media proxy` explicitamente nas iterações e volte a `--media master` antes da entrega. O HTML autoral é preservado; tempos manuais ainda precisam ser conferidos depois de alterar o corte. A biblioteca de movimento é copiada para a composição; em HTML existente, acrescente sua tag de script se quiser usar os helpers.

`check` e `render` agora resumem a saída e guardam logs em `06-review/`. Para reproduzir a saída completa, use `--verbose`.

O novo `.gitignore` exclui todos os projetos e marcas, inclusive arquivos antes liberados por regras amplas. Isso não remove dados do disco nem do histórico Git. Use o export público para iniciar uma publicação separada, conforme [PRIVACY.md](PRIVACY.md).

Fontes e SFX opcionais dos exemplos de vendor não são distribuídos no pacote público; o template básico inclui fontes próprias licenciadas. `skills:vendor` recupera o upstream fixado quando esses exemplos forem necessários, sem atualizar a versão por conta própria.
