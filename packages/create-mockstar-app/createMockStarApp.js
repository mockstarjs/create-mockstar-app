'use strict';

const chalk = require('chalk');
const commander = require('commander');
const envinfo = require('envinfo');
const fs = require('fs-extra');
const path = require('path');
const semver = require('semver');
const validateProjectName = require('validate-npm-package-name');
const { initProject } = require('mockstar-generators');

const packageJson = require('./package.json');

const { install, checkForLatestVersion } = require('./utils');

let projectName;

/**
 * 初始化命令
 */
function init() {
  const program = new commander.Command(packageJson.name)
    .version(packageJson.version)
    .arguments('<project-directory>')
    .usage(`${chalk.green('<project-directory>')} [options]`)
    .action(name => {
      projectName = name;
    })
    .option('--verbose', 'print additional logs')
    .option('--info', 'print environment debug info')
    .allowUnknownOption()
    .on('--help', () => {
      console.log(
        `    Only ${chalk.green('<project-directory>')} is required.`,
      );
      console.log();
      console.log(
        `    If you have any problems, do not hesitate to file an issue:`,
      );
      console.log(
        `      ${chalk.cyan(
          'https://github.com/mockstarjs/create-mockstar-app/issues/new',
        )}`,
      );
      console.log();
    })
    .parse(process.argv);

  if (program.info) {
    console.log(chalk.bold('\nEnvironment Info:'));
    console.log(
      `\n  current version of ${packageJson.name}: ${packageJson.version}`,
    );
    console.log(`  running from ${__dirname}`);
    return envinfo
      .run(
        {
          System: ['OS', 'CPU'],
          Binaries: ['Node', 'npm', 'Yarn'],
          Browsers: [
            'Chrome',
            'Edge',
            'Internet Explorer',
            'Firefox',
            'Safari',
          ],
          npmPackages: ['mockstar', 'mockstar-cli'],
          npmGlobalPackages: ['create-mockstar-app'],
        },
        {
          duplicates: true,
          showNotFound: true,
        },
      )
      .then(console.log);
  }

  if (typeof projectName === 'undefined') {
    console.error('Please specify the project directory:');
    console.log(
      `  ${chalk.cyan(program.name())} ${chalk.green('<project-directory>')}`,
    );
    console.log();
    console.log('For example:');
    console.log(
      `  ${chalk.cyan(program.name())} ${chalk.green('mockstar-app')}`,
    );
    console.log();
    console.log(
      `Run ${chalk.cyan(`${program.name()} --help`)} to see all options.`,
    );
    process.exit(1);
  }

  console.log();
  console.log(
    `Welcome use ${chalk.green(packageJson.name)} ${chalk.green(
      'v' + packageJson.version,
    )} to creating a new MockStar app.`,
  );
  console.log();

  console.log('Checking latest version...');
  const checkBeginT = Date.now();
  checkForLatestVersion('create-mockstar-app').then(latest => {
    console.log(
      `Check latest version complete(${(Date.now() - checkBeginT) / 1000}s) ! The latest version is ${latest}`,
    );

    if (latest && semver.lt(packageJson.version, latest)) {
      console.log();
      console.error(
        chalk.yellow(
          `You are running \`create-mockstar-app\` ${packageJson.version}, which is behind the latest release (${latest}).\n\n` +
          'We no longer support global installation of Create MockStar App.',
        ),
      );
      console.log();
      console.log(
        'Please remove any global installs with one of the following commands:\n' +
        '- npm uninstall -g create-mockstar-app\n' +
        '- yarn global remove create-mockstar-app',
      );
      console.log();
      // console.log(
      //   'The latest instructions for creating a new app can be found here:\n' +
      //     'https://create-mockstar-app.dev/docs/getting-started/'
      // );
      // console.log();
      process.exit(1);
    } else {
      createApp(projectName, program.verbose);
    }
  });
}

function createApp(name, verbose) {
  const unsupportedNodeVersion = !semver.satisfies(process.version, '>=6');
  if (unsupportedNodeVersion) {
    console.log(
      chalk.yellow(
        `You are using Node ${process.version} so the project will be bootstrapped with an old unsupported version of tools.\n\n` +
        `Please update to Node 6 or higher for a better, fully supported experience.\n`,
      ),
    );
  }

  const root = path.resolve(name);
  console.log();
  console.log(`MockStar App will create at ${chalk.green(root)}.`);
  console.log();

  const appName = path.basename(root);
  checkAppName(appName);

  const originalDirectory = process.cwd();

  initProject({
    isDev: false,
    force: true,
    parentPath: originalDirectory,
    name: appName,
    port: 9527,
    autoInstall: false,
    readmeDesc: `
本项目是由 [create-mockstar-app](https://www.npmjs.com/package/create-mockstar-app) 的基础模板初始化生成，相应的初始化命令如下：

\`\`\`
$ npx create-mockstar-app ${appName} 
\`\`\`
`,
  })
    .then(async () => {
      console.log();
      console.log(`Create success! Next to install dependencies. Also, you can cancel it and install by manual: `);
      console.log(`    cd ${root} && npm install`);
      console.log();
      console.log(`Here are some commands: `);
      console.log('    npm run start: star MockStar server');
      console.log('    npm run stop: stop MockStar server');
      console.log();
      console.log(chalk.green('For more info：https://mockstarjs.github.io/mockstar/'));
      console.log();

      await install(root, false, false, [], verbose, false).then(() => {
        console.log();
        console.log(chalk.green(`Congratulation! All dependencies success installed!`));
        console.log(`Here are some commands: `);
        console.log('    npm run start: star MockStar server');
        console.log('    npm run stop: stop MockStar server');
        console.log();
        console.log(chalk.green('For more info：https://mockstarjs.github.io/mockstar/'));
        console.log();
      });
      console.log();
    })
    .catch(err => {
      console.log();
      console.log(
        'Aborting installation because: ' + ((err && err.message) || err),
      );
      console.log(chalk.red('Please report it as a bug!'));
      console.log();

      // On 'exit' we will delete these files from target directory.
      const knownGeneratedFiles = ['package.json', 'yarn.lock', 'node_modules'];
      const currentFiles = fs.readdirSync(path.join(root));
      currentFiles.forEach(file => {
        knownGeneratedFiles.forEach(fileToMatch => {
          // This removes all knownGeneratedFiles.
          if (file === fileToMatch) {
            console.log(`Deleting generated file... ${chalk.cyan(file)}`);
            fs.removeSync(path.join(root, file));
          }
        });
      });
      const remainingFiles = fs.readdirSync(path.join(root));
      if (!remainingFiles.length) {
        // Delete target folder if empty
        console.log(
          `Deleting ${chalk.cyan(`${appName}/`)} from ${chalk.cyan(
            path.resolve(root, '..'),
          )}`,
        );
        process.chdir(path.resolve(root, '..'));
        fs.removeSync(path.join(root));
      }
      console.log('Done.');
      process.exit(1);
    });
}

function checkAppName(appName) {
  const validationResult = validateProjectName(appName);
  if (!validationResult.validForNewPackages) {
    console.error(
      chalk.red(
        `Cannot create a project named ${chalk.green(
          `"${appName}"`,
        )} because of npm naming restrictions:\n`,
      ),
    );
    [
      ...(validationResult.errors || []),
      ...(validationResult.warnings || []),
    ].forEach(error => {
      console.error(chalk.red(`  * ${error}`));
    });
    console.error(chalk.red('\nPlease choose a different project name.'));
    process.exit(1);
  }

  // TODO: there should be a single place that holds the dependencies
  const dependencies = ['mockstar', 'mockstar-cli'].sort();
  if (dependencies.includes(appName)) {
    console.error(
      chalk.red(
        `Cannot create a project named ${chalk.green(
          `"${appName}"`,
        )} because a dependency with the same name exists.\n` +
        `Due to the way npm works, the following names are not allowed:\n\n`,
      ) +
      chalk.cyan(dependencies.map(depName => `  ${depName}`).join('\n')) +
      chalk.red('\n\nPlease choose a different project name.'),
    );
    process.exit(1);
  }
}

module.exports = {
  init,
};
