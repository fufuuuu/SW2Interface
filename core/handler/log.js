const ResultEnum = {
  FAIL: '\x1B[31m%s\x1B[0m',
  SUCCESS: '\x1B[32m%s\x1B[0m',
  WARN: '\x1B[33m%s\x1B[0m',
  NOTICE: '\x1B[33m%s\x1B[0m',
}

const success = (text) => {
  console.log(ResultEnum.SUCCESS, text)
};

const error = (text) => {
  console.log(ResultEnum.FAIL, text)
};

const warn = (text) => {
  console.log(ResultEnum.WARN, text)
};

const notice = (text) => {
  console.log(ResultEnum.NOTICE, text)
};

module.exports = {
  success,
  error,
  warn,
  notice,
}