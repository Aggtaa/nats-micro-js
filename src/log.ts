import moment from 'moment';

function writeLog(level: string, ...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log(`${moment().format('h:mm:ss.SSS')} ${level} ${args.join(' ').replace(/\w+\[\[(.+?)\]\]/g, '$1')}`);
}

export const log = {
  error: (...args) => writeLog('ERROR', ...args),
  info: (...args) => writeLog('INFO', ...args),
  warn: (...args) => writeLog('WARN', ...args),
  debug: (...args) => writeLog('DEBUG', ...args),
  silly: (...args) => writeLog('SILLY', ...args),
};
