const defaultjson = `
{
  "files":{
    "targetPath": "sw2interface/target",
    "resultPath": "sw2interface/result",
    "apiResultPath": "sw2interface/result"
  },
  "options":{
    "swaggerUrl": "",
    "targetFileName": "",
    "resultFileName": "interfaces.ts",
    "apiResultFileName": "apis.ts",
    "readonly": false,
    "splitApis": false,
    "interfacesConfig": {
      "global": false,
      "optional": false,
      "interfaceTemplateFile": "",
    },
    "apisConfig": {
      "realName": [],
      "optional": [],
      "anonymous": [],
      "apiTemplatePath": ""
    }
  }
}
`
const path = require('path')
const fs = require('fs')
const createDefaultConfig = (_path) => {
  try {
    //生成json文件目录
    if (fs.existsSync('./sw2interface')) {
      console.error('/sw2interface路由已存在，请删除sw2interface文件夹后重试')
    } else {
      fs.mkdirSync(path.resolve(_path, './sw2interface'))
      //生成配置文件
      fs.writeFileSync(path.resolve(_path, './sw2interface/sw2interface.json'), defaultjson, { encoding: 'utf-8' })
    }
  } catch (e) {
    console.log(e.toString())
  }
}
module.exports = createDefaultConfig;