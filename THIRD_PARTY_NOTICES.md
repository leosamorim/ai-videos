# Componentes de terceiros

A licença MIT da raiz cobre o código e a documentação originais deste projeto. Ela não altera as licenças abaixo nem concede direitos sobre mídias fornecidas pelo usuário.

| Componente | Origem e licença | Distribuição |
| --- | --- | --- |
| Skills técnicas do HyperFrames | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes), Apache-2.0; versão e commit em [skills.lock.json](vendor/skills.lock.json) | Texto, código e exemplos em `.claude/skills/`; licença integral em [vendor/licenses](vendor/licenses/hyperframes-LICENSE). Há adaptações locais de roteamento e política feitas por `scripts/lib/skill-policy.mjs` e `scripts/vendor-skills.mjs`. |
| HyperFrames CLI | Dependência fixada em `package-lock.json` | Instalado por npm; não incluído no export público. |
| GSAP | [GSAP Standard License](https://gsap.com/community/standard-license/); conferir também `node_modules/gsap/package.json` da versão instalada | Dependência npm fixada. As cópias minificadas de exemplos não entram no export; o mecanismo copia o runtime instalado para cada composição local. |
| Inter, pesos 400/600/700 | Copyright The Inter Project Authors, SIL Open Font License 1.1 | `templates/fonts/`; [licença integral](templates/fonts/OFL-Inter.txt). Binários provenientes dos recursos da versão fixada do HyperFrames. |

As demais fontes e os efeitos sonoros dos exemplos vendorizados não integram a distribuição pública. `npm run skills:vendor` pode recuperar os recursos do upstream para uso local. Esse comando não substitui a conferência da licença de cada asset antes de usá-lo ou redistribuí-lo. Alguns exemplos opcionais das skills dependem desses recursos; o fluxo básico usa apenas Inter e as dependências npm.

Sites/repositórios citados em `library/sources.json` são rotas de descoberta, não dependências redistribuídas nem autorização para reutilizar seus vídeos, marcas ou fotografias. Registre a origem e os direitos dos materiais em cada projeto privado.
