const fs = require("fs");
const path = require("path");
const makeInterface = require("./handler/handler").makeInterface;
const handlePaths = require("./handler/pathHandler").handlePaths;
const userNeedInit = require("./handler/reader").userNeedInit;
const updateNullableFields = require("./handler/update").updateNullableFields;
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const log = require("./handler/log");
const defaultInit = require("../core/init");
const prettier = require("prettier");

const init = () => {
  defaultInit(process.cwd());
};
/**
 * 执行程序
 * @param {'ALL' | 'DATA' | 'REQUEST'} process 执行生成文件的程序：全部、数据类型、接口请求
 */
const execute = async (mode = "ALL") => {
  // 读取配置文件
  const config = await getConfig();
  if (!config) {
    return;
  }
  // interface文件写入内容
  let interfaces = "";
  const { files } = config;
  const { options } = config;

  if (!options.swaggerUrl) {
    log.error(
      `请在 ${process.cwd() + "\\sw2interface\\sw2interface.json"} 中填写目标swaggerUrl`,
    );
    return;
  } // 读取swagger api文档接口响应并转为本地json文件
  getJsonFromUrl(options, files).then((res) => {
    const { componentsContent, paths } = res;
    const components = JSON.parse(componentsContent); /**
     * 生成请求代码
     */
    if (files.apiResultPath && options.apiResultFileName && mode !== "DATA") {
      const { pathResult, requestUrls } = handlePaths(options, paths);
      pathResult &&
        Object.keys(pathResult).forEach((item) => {
          const fileName = options.splitApis
            ? `${item}.ts`
            : options.apiResultFileName; // prettier格式化api文本
          prettierFormat(pathResult[item])
            .then((prettierContent) => {
              writeInFile(files.apiResultPath, fileName, prettierContent);
            })
            .catch((err) => {
              console.log(err);
              writeInFile(files.apiResultPath, fileName, pathResult[item]);
            });
        });
      requestUrls &&
        prettierFormat(requestUrls)
          .then((prettierContent) => {
            writeInFile(files.apiResultPath, "requestUrls.ts", prettierContent);
          })
          .catch((err) => {
            console.log(err);
          });
    } /**
     * 生成数据类型
     */
    if (mode !== "REQUEST") {
      //  读取接口返回的json数据
      if (!components) {
        log.error("读取数据有误");
        return;
      } // 获取interface的nameIndex数组和interface内容数组
      const nameIndexs = Object.keys(components);
      const interfacePool = Object.values(components).map((value) => {
        // 如果对象中有required字段，则根据required字段判断对象中的每个字段是否为必传
        for (let item in value.properties) {
          if (value.required !== undefined) {
            // 不为undefined时，则根据对象中的required判断是否必传
            value.properties[item].required = value.required.includes(item);
          }
        }
        return value.properties;
      });

      interfacePool.forEach((_interface, index) => {
        // 生成interface文本
        interfaces += makeInterface(nameIndexs[index], _interface, options);
      });
      let resultFileName = options.resultFileName; // 如果开启全局interface，则文件名后缀改为.d.ts
      if (
        options.interfacesConfig &&
        options.interfacesConfig.global &&
        !resultFileName.endsWith(".d.ts")
      ) {
        resultFileName = resultFileName.replace(/\.ts$/, ".d.ts");
      } // prettier格式化interface文本

      prettierFormat(interfaces).then((prettierContent) => {
        let contentWithModified = prettierContent;
        const { interfaceTemplateFile } = options.interfacesConfig;
        if (interfaceTemplateFile) {
          const templateContent = fs.readFileSync(interfaceTemplateFile, {
            encoding: "utf-8",
          });
          templateContent &&
            (contentWithModified = updateNullableFields(
              templateContent,
              prettierContent,
            ));
        } // 转换后的数据写入目标文件
        writeInFile(files.resultPath, resultFileName, contentWithModified);
        log.success("SW2Interface Finished!");
      });
    }
  });
};

const getConfig = () => {
  const appfile = process.cwd();
  const configname = path.resolve(appfile, "./sw2interface/sw2interface.json");
  let mainconfig = {}; //如果配置文件存在
  if (fs.existsSync(configname)) {
    let config = fs.readFileSync(configname, {
      encoding: "utf-8",
    });
    try {
      config = JSON.parse(config);
      mainconfig = {
        ...config,
      };
      const files = mainconfig.files;
      for (let item in files) {
        if (files[item]) {
          files[item] = path.resolve(appfile, files[item]);
        } else {
          files[item] = "";
        }
      }
      mainconfig.files = files;
      return mainconfig;
    } catch (error) {
      log.error("配置文件有误：" + JSON.stringify(error));
      return null;
    }
  } else {
    return userNeedInit()
      .then(() => {
        init();
        return null;
      })
      .catch(() => {
        return null;
      });
  }
};

const getJsonFromUrl = (options, fileConfigs) => {
  return new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", options.swaggerUrl, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
          const json = JSON.parse(xhr.responseText);
          const { components, paths, definitions } = json;
          let componentsContent;
          if (components && components.schemas) {
            componentsContent = JSON.stringify(components.schemas);
          } else if (definitions) {
            componentsContent = JSON.stringify(definitions);
          } else {
            reject();
          }
          const pathContent = JSON.stringify(paths);
          if (fileConfigs.targetPath && options.targetFileName) {
            writeInFile(
              fileConfigs.targetPath,
              options.targetFileName,
              componentsContent,
            );
            writeInFile(fileConfigs.targetPath, "paths.json", pathContent);
          }
          resolve({ componentsContent, paths });
        } else if (xhr.readyState === 4) {
          log.error("ERROR" + xhr.status + ": " + xhr.responseText);
          reject();
        }
      };
      xhr.send();
    } catch (error) {
      log.error(error);
    }
  });
};

/** prettier格式化interface */
const prettierFormat = (content) => {
  try {
    return prettier.format(content, {
      parser: "typescript", // 解析器，默认是babylon
      singleQuote: true, // 单引号
      semi: true, // 分号
      trailingComma: "all", // 尾随逗号
      printWidth: 120, // 换行宽度
      tabWidth: 2, // 缩进
      useTabs: false, // 使用tab
      bracketSpacing: true, // 大括号空格
      jsxBracketSameLine: false, // 单行jsx元素
      arrowParens: "always", // 箭头函数参数括号
      endOfLine: "auto", // 换行符
    });
  } catch (error) {
    log.error(error);
    return Promise.reject(error);
  }
};

const writeInFile = (filePath, fileName, fileContent) => {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath);
    const outputfilepath = path.resolve(filePath, fileName);
    fs.writeFileSync(outputfilepath, fileContent);
  } else {
    const outputfilepath = path.resolve(filePath, fileName);
    fs.writeFileSync(outputfilepath, fileContent);
  }
};

module.exports = {
  getJsonFromUrl,
  getConfig,
  execute,
};
