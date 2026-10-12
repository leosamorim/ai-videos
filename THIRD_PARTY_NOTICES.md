# Componentes de terceiros

A licença MIT da raiz cobre o código e a documentação originais deste projeto. Ela não altera as licenças abaixo nem concede direitos sobre mídias fornecidas pelo usuário.

| Componente | Origem e licença | Distribuição |
| --- | --- | --- |
| Skills técnicas do HyperFrames | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes), Apache-2.0; versão e commit em [skills.lock.json](vendor/skills.lock.json) | Texto, código e exemplos em `.claude/skills/`; licença integral em [vendor/licenses](vendor/licenses/hyperframes-LICENSE). Há adaptações locais de roteamento e política feitas por `scripts/lib/skill-policy.mjs` e `scripts/vendor-skills.mjs`. |
| HyperFrames CLI | Dependência fixada em `package-lock.json` | Instalado por npm; não incluído no export público. |
| GSAP | [GSAP Standard License](https://gsap.com/community/standard-license/); conferir também `node_modules/gsap/package.json` da versão instalada | Dependência npm fixada. As cópias minificadas de exemplos não entram no export; o mecanismo copia o runtime instalado para cada composição local. |
| Inter, pesos 400/600/700 | Copyright The Inter Project Authors, SIL Open Font License 1.1 | `templates/fonts/`; [licença integral](templates/fonts/OFL-Inter.txt). Binários provenientes dos recursos da versão fixada do HyperFrames. |
| Silero VAD | [snakers4/silero-vad](https://github.com/snakers4/silero-vad), MIT | Modelo ONNX opcional baixado do upstream por `signals setup`; URL/commit/SHA-256 em `scripts/analysis/models.lock.json`. Não redistribuído no Git/export. |
| ONNX Runtime e NumPy | [microsoft/onnxruntime](https://github.com/microsoft/onnxruntime), MIT; [numpy/numpy](https://github.com/numpy/numpy), BSD-3-Clause | Dependências Python opcionais, instaladas por pip com seus próprios avisos. |
| MediaPipe e OpenCV | [google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe), Apache-2.0; [opencv/opencv](https://github.com/opencv/opencv), Apache-2.0 | Bibliotecas opcionais instaladas por pip. Os pacotes podem trazer componentes e avisos adicionais. |
| Modelos Face/Pose Landmarker | Downloads oficiais indicados nos guias [Face](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker) e [Pose](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker) | Pesos opcionais, baixados para cache com hash fixado. Não incluídos no Git/export. Consultar os model cards/termos de cada modelo antes de redistribuir; a MIT deste repo não relicencia os pesos. |

As demais fontes e os efeitos sonoros dos exemplos vendorizados não integram a distribuição pública. `npm run skills:vendor` pode recuperar os recursos do upstream para uso local. Esse comando não substitui a conferência da licença de cada asset antes de usá-lo ou redistribuí-lo. Alguns exemplos opcionais das skills dependem desses recursos; o fluxo básico usa apenas Inter e as dependências npm.

Sites/repositórios citados em `library/sources.json` são rotas de descoberta, não dependências redistribuídas nem autorização para reutilizar seus vídeos, marcas ou fotografias. Registre a origem e os direitos dos materiais em cada projeto privado.
