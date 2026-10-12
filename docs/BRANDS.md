# Marcas e preferências locais

Sem `brand/`, a composição usa Inter e o tema genérico. Cada projeto controla seu próprio `theme.json`, briefing e referências.

Para personalizar, crie localmente `brand/fonts/fonts.json` com uma lista de `{family, file, weight, style}` e os respectivos `.woff2`. Registre os direitos de uso. Outras pastas opcionais são `brand/logos/`, `brand/sfx/` e `brand/music/`; `brand/captions.json` fornece valores iniciais de legenda. O `compose` copia os recursos para a composição, que fica autossuficiente localmente.

O manifesto de fontes declara as famílias aceitas pelo tema. `theme.captions` define valores iniciais; uma configuração já existente em `04-composition/captions.config.json` tem precedência nas revisões. Use `vid captions` para regenerar a partir da configuração atual.

Uma aprovação de estilo pertence à marca e ao contexto do exemplo. Use `vid remember` para preservar feedback explícito e diferencie avaliação do agente de preferência do usuário. Não publique essa memória no repositório do mecanismo.
