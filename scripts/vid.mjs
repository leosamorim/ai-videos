#!/usr/bin/env node
// Ponto de entrada único das ferramentas do pipeline.
//   node scripts/vid.mjs <comando> [args]      (ou: npm run vid -- <comando> [args])
import { UserError } from './lib/util.mjs';

const COMMANDS = {
  welcome: ['welcome', 'Orientação do primeiro uso, sem alterar estado; --ack registra apresentação, --preview relê'],
  new: ['project', 'Cria videos/<slug>/ no padrão de pastas a partir de um vídeo bruto'],
  status: ['project', 'Mostra em que etapa o projeto está e o próximo passo'],
  resume: ['resume', 'Retomada compacta e somente leitura: estado, briefing e transcrição (--chars N)'],
  list: ['project', 'Lista os projetos e suas etapas'],
  gate: ['project', 'Registra a aprovação humana de uma etapa: cut | plan | draft'],
  stage: ['project', 'Marca manualmente o estado de uma etapa'],
  transcribe: ['transcript', 'Transcreve o bruto com tempo por palavra (local ou ElevenLabs)'],
  words: ['transcript', 'Lista palavras com índice, tempo e pausa (para escolher cortes)'],
  reference: ['references', 'Adiciona site/arquivo de tema, marca, edição ou B-roll; sem entrada, lista referências'],
  discover: ['discovery', 'Busca referências locais e fontes por finalidade; --online openverse|catalog consulta metadados'],
  remember: ['discovery', 'Registra uma referência analisada e feedback a partir de um JSON; --replace revisa explicitamente'],
  strategy: ['strategy', 'Inicia (--init) ou valida direção de marketing orgânico ligada ao storyboard'],
  analyze: ['analyze', 'Prepara vídeo de inspeção, quadros e candidatos a retomadas/preparação'],
  inspect: ['analyze', 'Examina um intervalo: --from segundos --to segundos; clip + sequência densa'],
  editorial: ['analyze', 'Valida seleção de takes, descartes, evidências e cobertura do bruto'],
  plan: ['plan', 'Inicia (--init) ou valida storyboard com âncoras por palavra e tema'],
  review: ['review', 'Prepara ou conclui (--complete) a revisão audiovisual do render'],
  diff: ['diff', 'Compara renders por pixels/áudio decodificados e indica intervalos de revisão'],
  silences: ['cut', 'Mede silêncios no áudio e propõe cortes em 02-cut/cuts.json'],
  cut: ['cut', 'Aplica cuts.json: gera clean.mp4, edl.json e a transcrição re-temporizada'],
  compose: ['compose', 'Prepara 04-composition/ (projeto HyperFrames) a partir do corte'],
  captions: ['compose', 'Gera as legendas sincronizadas por palavra'],
  check: ['compose', 'Roda lint + validação + inspeção de layout do HyperFrames'],
  snapshot: ['compose', 'Captura quadros da composição atual, sem renderizar: --at 1.5,3,7.2'],
  render: ['compose', 'Renderiza um draft numerado em 05-renders/'],
  frames: ['review', 'Extrai folhas de contato; --seq INICIO-FIM dá quadros consecutivos para conferir movimento'],
  loudness: ['review', 'Mede LUFS e true peak de um arquivo'],
  verify: ['review', 'Checa um render: formato, duração, tela preta, congelamento, áudio'],
  finalize: ['review', 'Normaliza o áudio do draft aprovado e grava final.mp4'],
  doctor: ['doctor', 'Confere se a máquina e o repo estão prontos'],
};

function help() {
  console.log('Uso: node scripts/vid.mjs <comando> [args]\n');
  const width = Math.max(...Object.keys(COMMANDS).map((c) => c.length));
  for (const [name, [, text]] of Object.entries(COMMANDS)) console.log(`  ${name.padEnd(width)}  ${text}`);
  console.log('\nDetalhes de cada comando: docs/PIPELINE.md');
}

const [command, ...args] = process.argv.slice(2);
if (!command || command === 'help' || command === '--help') {
  help();
  process.exit(command ? 0 : 1);
}
if (!COMMANDS[command]) {
  console.error(`comando desconhecido: ${command}\n`);
  help();
  process.exit(1);
}

try {
  const module = await import(`./commands/${COMMANDS[command][0]}.mjs`);
  await module[command](args);
} catch (error) {
  if (error instanceof UserError) {
    console.error(`erro: ${error.message}`);
    process.exit(1);
  }
  throw error;
}
