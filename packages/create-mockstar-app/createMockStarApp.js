'use strict';

const chalk = require('chalk');
const commander = require('commander');
const envinfo = require('envinfo');
const execSync = require('child_process').execSync;
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const semver = require('semver');
const validateProjectName = require('validate-npm-package-name');

const packageJson = require('./package.json');

const {
  shouldUseYarn,
  install,
  getPackageInfo,
  checkNpmVersion,
  checkYarnVersion,
  checkNodeVersion,
  makeCaretRange,
  isSafeToCreateProjectIn,
  checkThatNpmCanReadCwd,
  checkIfOnline,
  executeNodeScript,
  checkForLatestVersion,
} = require('./utils');

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
    .option(
      '--scripts-version <alternative-package>',
      'use a non-standard version of mockstar-cli'
    )
    .option('--use-npm')
    .option('--use-pnp')
    .allowUnknownOption()
    .on('--help', () => {
      console.log(
        `    Only ${chalk.green('<project-directory>')} is required.`
      );
      console.log();
      console.log(
        `    A custom ${chalk.cyan('--scripts-version')} can be one of:`
      );
      console.log(`      - a specific npm version: ${chalk.green('1.3.8')}`);
      console.log(`      - a specific npm tag: ${chalk.green('@latest')}`);
      console.log();
      console.log(
        `    If you have any problems, do not hesitate to file an issue:`
      );
      console.log(
        `      ${chalk.cyan(
          'https://github.com/mockstarjs/create-mockstar-app/issues/new'
        )}`
      );
      console.log();
    })
    .parse(process.argv);

  if (program.info) {
    console.log(chalk.bold('\nEnvironment Info:'));
    console.log(
      `\n  current version of ${packageJson.name}: ${packageJson.version}`
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
        }
      )
      .then(console.log);
  }

  if (typeof projectName === 'undefined') {
    console.error('Please specify the project directory:');
    console.log(
      `  ${chalk.cyan(program.name())} ${chalk.green('<project-directory>')}`
    );
    console.log();
    console.log('For example:');
    console.log(
      `  ${chalk.cyan(program.name())} ${chalk.green('mockstar-app')}`
    );
    console.log();
    console.log(
      `Run ${chalk.cyan(`${program.name()} --help`)} to see all options.`
    );
    process.exit(1);
  }

  // We first check the registry directly via the API, and if that fails, we try
  // the slower `npm view [package] version` command.
  //
  // This is important for users in environments where direct access to npm is
  // blocked by a firewall, and packages are provided exclusively via a private
  // registry.
  checkForLatestVersion('create-mockstar-app')
    .catch(() => {
      try {
        return execSync('npm view create-mockstar-app version')
          .toString()
          .trim();
      } catch (e) {
        return null;
      }
    })
    .then(latest => {
      if (latest && semver.lt(packageJson.version, latest)) {
        console.log();
        console.error(
          chalk.yellow(
            `You are running \`create-mockstar-app\` ${packageJson.version}, which is behind the latest release (${latest}).\n\n` +
              'We no longer support global installation of Create MockStar App.'
          )
        );
        console.log();
        console.log(
          'Please remove any global installs with one of the following commands:\n' +
            '- npm uninstall -g create-mockstar-app\n' +
            '- yarn global remove create-mockstar-app'
        );
        console.log();
        // console.log(
        //   'The latest instructions for creating a new app can be found here:\n' +
        //     'https://create-mockstar-app.dev/docs/getting-started/'
        // );
        // console.log();
        process.exit(1);
      } else {
        createApp(
          projectName,
          program.verbose,
          program.scriptsVersion,
          program.template,
          program.useNpm,
          program.usePnp
        );
      }
    });
}

function createApp(name, verbose, version, template, useNpm, usePnp) {
  const unsupportedNodeVersion = !semver.satisfies(process.version, '>=10');
  if (unsupportedNodeVersion) {
    console.log(
      chalk.yellow(
        `You are using Node ${process.version} so the project will be bootstrapped with an old unsupported version of tools.\n\n` +
          `Please update to Node 10 or higher for a better, fully supported experience.\n`
      )
    );
  }

  const root = path.resolve(name);
  const appName = path.basename(root);

  // 创建 mockstar-app 文件夹目录
  checkAppName(appName);
  fs.ensureDirSync(name);
  if (!isSafeToCreateProjectIn(root, name)) {
    process.exit(1);
  }
  console.log();
  console.log(`Creating a new MockStar app in ${chalk.green(root)}.`);
  console.log();

  // 创建 mockstar-app 的 package.json
  const packageJson = {
    name: appName,
    version: '0.1.0',
    private: true,
  };
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify(packageJson, null, 2) + os.EOL
  );

  const useYarn = useNpm ? false : shouldUseYarn();
  const originalDirectory = process.cwd();
  process.chdir(root);
  if (!useYarn && !checkThatNpmCanReadCwd()) {
    process.exit(1);
  }

  if (!useYarn) {
    const npmInfo = checkNpmVersion();
    if (!npmInfo.hasMinNpm) {
      if (npmInfo.npmVersion) {
        console.log(
          chalk.yellow(
            `You are using npm ${npmInfo.npmVersion} so the project will be bootstrapped with an old unsupported version of tools.\n\n` +
              `Please update to npm 6 or higher for a better, fully supported experience.\n`
          )
        );
      }
    }
  } else if (usePnp) {
    const yarnInfo = checkYarnVersion();
    if (yarnInfo.yarnVersion) {
      if (!yarnInfo.hasMinYarnPnp) {
        console.log(
          chalk.yellow(
            `You are using Yarn ${yarnInfo.yarnVersion} together with the --use-pnp flag, but Plug'n'Play is only supported starting from the 1.12 release.\n\n` +
              `Please update to Yarn 1.12 or higher for a better, fully supported experience.\n`
          )
        );
        // 1.11 had an issue with webpack-dev-middleware, so better not use PnP with it (never reached stable, but still)
        usePnp = false;
      }
      if (!yarnInfo.hasMaxYarnPnp) {
        console.log(
          chalk.yellow(
            'The --use-pnp flag is no longer necessary with yarn 2 and will be deprecated and removed in a future release.\n'
          )
        );
        // 2 supports PnP by default and breaks when trying to use the flag
        usePnp = false;
      }
    }
  }

  if (useYarn) {
    let yarnUsesDefaultRegistry = true;
    try {
      yarnUsesDefaultRegistry =
        execSync('yarnpkg config get registry').toString().trim() ===
        'https://registry.yarnpkg.com';
    } catch (e) {
      // ignore
    }
    if (yarnUsesDefaultRegistry) {
      fs.copySync(
        require.resolve('./yarn.lock.cached'),
        path.join(root, 'yarn.lock')
      );
    }
  }

  run(
    root,
    appName,
    version,
    verbose,
    originalDirectory,
    template,
    useYarn,
    usePnp
  );
}

function run(
  shouldUseYarn,
  root,
  appName,
  version,
  verbose,
  originalDirectory,
  template,
  useYarn,
  usePnp
) {
  Promise.all([
    getInstallPackage(version, originalDirectory),
    getTemplateInstallPackage(template, originalDirectory),
  ]).then(([packageToInstall, templateToInstall]) => {
    const allDependencies = ['mockstar', 'mockstar-cli', packageToInstall];

    console.log('Installing packages. This might take a couple of minutes.');

    Promise.all([
      getPackageInfo(packageToInstall),
      getPackageInfo(templateToInstall),
    ])
      .then(([packageInfo, templateInfo]) =>
        checkIfOnline(useYarn).then(isOnline => ({
          isOnline,
          packageInfo,
          templateInfo,
        }))
      )
      .then(({ isOnline, packageInfo, templateInfo }) => {
        let packageVersion = semver.coerce(packageInfo.version);

        const templatesVersionMinimum = '0.1.0';

        // Assume compatibility if we can't test the version.
        if (!semver.valid(packageVersion)) {
          packageVersion = templatesVersionMinimum;
        }

        // Only support templates when used alongside new react-scripts versions.
        const supportsTemplates = semver.gte(
          packageVersion,
          templatesVersionMinimum
        );
        if (supportsTemplates) {
          allDependencies.push(templateToInstall);
        }

        console.log(
          `Installing ${chalk.cyan('mockstar')}, ${chalk.cyan(
            'mockstar-cli'
          )}, and ${chalk.cyan(packageInfo.name)}${
            supportsTemplates ? ` with ${chalk.cyan(templateInfo.name)}` : ''
          }...`
        );
        console.log();

        return install(
          root,
          useYarn,
          usePnp,
          allDependencies,
          verbose,
          isOnline
        ).then(() => ({
          packageInfo,
          supportsTemplates,
          templateInfo,
        }));
      })
      .then(async ({ packageInfo, supportsTemplates, templateInfo }) => {
        const packageName = packageInfo.name;
        const templateName = supportsTemplates ? templateInfo.name : undefined;
        checkNodeVersion(packageName);
        setCaretRangeForRuntimeDeps(packageName);

        const pnpPath = path.resolve(process.cwd(), '.pnp.js');

        const nodeArgs = fs.existsSync(pnpPath) ? ['--require', pnpPath] : [];

        await executeNodeScript(
          {
            cwd: process.cwd(),
            args: nodeArgs,
          },
          [root, appName, verbose, originalDirectory, templateName],
          `
        var init = require('${packageName}/scripts/init.js');
        init.apply(null, JSON.parse(process.argv[1]));
      `
        );
      })
      .catch(reason => {
        console.log();
        console.log('Aborting installation.');
        if (reason.command) {
          console.log(`  ${chalk.cyan(reason.command)} has failed.`);
        } else {
          console.log(
            chalk.red('Unexpected error. Please report it as a bug:')
          );
          console.log(reason);
        }
        console.log();

        // On 'exit' we will delete these files from target directory.
        const knownGeneratedFiles = [
          'package.json',
          'yarn.lock',
          'node_modules',
        ];
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
              path.resolve(root, '..')
            )}`
          );
          process.chdir(path.resolve(root, '..'));
          fs.removeSync(path.join(root));
        }
        console.log('Done.');
        process.exit(1);
      });
  });
}

function getInstallPackage(version, originalDirectory) {
  let packageToInstall = 'mockstar-cli';
  const validSemver = semver.valid(version);
  if (validSemver) {
    packageToInstall += `@${validSemver}`;
  } else if (version) {
    if (version[0] === '@' && !version.includes('/')) {
      packageToInstall += version;
    } else if (version.match(/^file:/)) {
      packageToInstall = `file:${path.resolve(
        originalDirectory,
        version.match(/^file:(.*)?$/)[1]
      )}`;
    } else {
      // for tar.gz or alternative paths
      packageToInstall = version;
    }
  }

  return Promise.resolve(packageToInstall);
}

function getTemplateInstallPackage(template, originalDirectory) {
  let templateToInstall = 'create-mockstar-app-template';
  if (template) {
    if (template.match(/^file:/)) {
      templateToInstall = `file:${path.resolve(
        originalDirectory,
        template.match(/^file:(.*)?$/)[1]
      )}`;
    } else if (
      template.includes('://') ||
      template.match(/^.+\.(tgz|tar\.gz)$/)
    ) {
      // for tar.gz or alternative paths
      templateToInstall = template;
    } else {
      // Add prefix 'create-mockstar-app-template-' to non-prefixed templates, leaving any
      // @scope/ and @version intact.
      const packageMatch = template.match(/^(@[^/]+\/)?([^@]+)?(@.+)?$/);
      const scope = packageMatch[1] || '';
      const templateName = packageMatch[2] || '';
      const version = packageMatch[3] || '';

      if (
        templateName === templateToInstall ||
        templateName.startsWith(`${templateToInstall}-`)
      ) {
        // Covers:
        // - cra-template
        // - @SCOPE/cra-template
        // - cra-template-NAME
        // - @SCOPE/cra-template-NAME
        templateToInstall = `${scope}${templateName}${version}`;
      } else if (version && !scope && !templateName) {
        // Covers using @SCOPE only
        templateToInstall = `${version}/${templateToInstall}`;
      } else {
        // Covers templates without the `cra-template` prefix:
        // - NAME
        // - @SCOPE/NAME
        templateToInstall = `${scope}${templateToInstall}-${templateName}${version}`;
      }
    }
  }

  return Promise.resolve(templateToInstall);
}

function checkAppName(appName) {
  const validationResult = validateProjectName(appName);
  if (!validationResult.validForNewPackages) {
    console.error(
      chalk.red(
        `Cannot create a project named ${chalk.green(
          `"${appName}"`
        )} because of npm naming restrictions:\n`
      )
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
          `"${appName}"`
        )} because a dependency with the same name exists.\n` +
          `Due to the way npm works, the following names are not allowed:\n\n`
      ) +
        chalk.cyan(dependencies.map(depName => `  ${depName}`).join('\n')) +
        chalk.red('\n\nPlease choose a different project name.')
    );
    process.exit(1);
  }
}

function setCaretRangeForRuntimeDeps(packageName) {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = require(packagePath);

  if (typeof packageJson.dependencies === 'undefined') {
    console.error(chalk.red('Missing dependencies in package.json'));
    process.exit(1);
  }

  const packageVersion = packageJson.dependencies[packageName];
  if (typeof packageVersion === 'undefined') {
    console.error(chalk.red(`Unable to find ${packageName} in package.json`));
    process.exit(1);
  }

  makeCaretRange(packageJson.dependencies, 'mockstar');
  makeCaretRange(packageJson.dependencies, 'mockstar-cli');

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + os.EOL);
}

module.exports = {
  init,
  getTemplateInstallPackage,
};
