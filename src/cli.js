import { Command } from "commander";
import promptCommand from './commands/prompt.js';
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import logger from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, "../package.json");
const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));

export async function main(argv = process.argv) {
  const program = new Command();

  // 전역 옵션
  program.option('-V, --verbose', '자세한 로그를 출력합니다.');

  program
    .name("acommit")
    .description("AI 기반 맞춤 커밋 메시지 생성기")
    .version(pkg.version, '-v, --version', '버전 정보를 출력합니다.');

  program
    .command("run")
    .description("변경분을 수집하고 커밋 메시지를 생성합니다.")
    .option("-C, --cwd <path>", "작업 디렉터리", process.cwd())
    .action(async (opts) => {
      if (opts.cwd && opts.cwd !== process.cwd()) process.chdir(opts.cwd);
      const mod = await import('./commands/run.js');
      const fn = mod.run || mod.default;
      await fn();
    });

  // 액션 실행 전에 전역 플래그를 적용한다.
  program.hook('preAction', (thisCommand) => {
    // 하위 명령에서도 최상위 옵션을 조회한다.
    const globalOpts = (thisCommand.parent && typeof thisCommand.parent.opts === 'function') ? thisCommand.parent.opts() : program.opts();
    if (globalOpts && globalOpts.verbose) {
      logger.setLevel('VERBOSE');
      logger.info('자세한 로깅을 활성화했습니다.');
    }
  });

  program
    .command('prompt')
    .description('일회성 혹은 지속 프롬프트를 추가합니다.')
    .option('-m, --message <msg>', '에디터 없이 한 줄 프롬프트를 입력합니다.')
    .option('--save', '.acommit/rules.yml 에 영구적으로 저장합니다.')
    .action((opts) => promptCommand(opts));

  program
    .command('model')
    .description('acommit 에서 사용할 LLM 제공자를 선택합니다.')
    .option('-p, --provider <name>', '직접 지정할 제공자 (gemini|openai)')
    .action(async (opts) => {
      const mod = await import('./commands/model.js');
      const fn = mod.modelCommand || mod.default;
      await fn(opts);
    });

  program
    .command("init")
    .description(".acommit/rules.yml 템플릿을 생성하고 .gitignore 를 갱신합니다.")
    .option("--lang <code>", "템플릿 언어 (ko|en)", "ko")
    .option("-C, --cwd <path>", "작업 디렉터리", process.cwd())
    .action(async (opts) => {
      if (opts.cwd && opts.cwd !== process.cwd()) process.chdir(opts.cwd);
      const mod = await import('./commands/init.js');
      const fn = mod.initConfig || mod.init || mod.default;
      await fn({ lang: opts.lang, cwd: process.cwd() });
    });

  program
    .hook("postAction", () => {}) 
    .showHelpAfterError();

  if (argv.length <= 2) {
    program.outputHelp();
    return;
  }

  await program.parseAsync(argv);
}