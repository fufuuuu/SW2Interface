#!/usr/bin/env node
const defaultInit = require('./core/init');
const Progress = require('./core/index');
const log = require('./core/handler/log');

const execute = (mode = 'ALL') => {
  Progress.execute(mode);
}

if(process.argv.length === 2) {
  execute();
} else if (process.argv.length === 3) {
  const command = process.argv[2];
  switch(command) {
    case "init":
      defaultInit(process.cwd());
      break;
    case "data":
      execute('DATA');
      break;
    case "req":
      execute('REQUEST');
      break;
    default:
      log.warn('支持init | data | req命令，确认后再执行');
      break;
  }
}