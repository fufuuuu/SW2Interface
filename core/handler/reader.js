const path = require('path');
const fs = require('fs');

const userNeedInit = () => {
  return new Promise((resolve, reject) => {
    // 从命令行读取用户输入并输出
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    readline.question(`是否执行项目初始化程序?(Y/N)`, (stdin) => {
      if (['Y', 'N'].includes(stdin.toUpperCase())) {
        readline.close()
        stdin.toUpperCase() === 'Y' ? resolve() : reject();
      } else {
        return userNeedInit();
      }
    });
  })
}

const readFile = (filepath) => {
  if (!fs.existsSync(filepath)) {
    console.error('未查询到该文件' + filepath)
  } else {
    const filecontent = fs.readFileSync(path.resolve(filepath), { encoding: 'utf-8' })
    return JSON.parse(filecontent);
  }
}

module.exports = {
  readFile,
  userNeedInit,
}