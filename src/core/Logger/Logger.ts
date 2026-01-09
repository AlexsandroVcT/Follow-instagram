import chalk from 'chalk';

export class Logger {
  static info(message: string) {
    console.log(chalk.cyan('[INFO]'), message);
  }

  static success(message: string) {
    console.log(chalk.green('[SUCCESS]'), message);
  }

  static warn(message: string) {
    console.log(chalk.yellow('[WARN]'), message);
  }

  static error(message: string) {
    console.log(chalk.red('[ERROR]'), message);
  }

  static action(message: string) {
    console.log(chalk.magenta('[ACTION]'), message);
  }

  static wait(message: string) {
    console.log(chalk.blue('[WAIT]'), message);
  }
}
