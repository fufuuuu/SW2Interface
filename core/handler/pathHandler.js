const handleNameIndex = require("./handler").handleNameIndex;
const fs = require("fs");
const log = require("./log");
const pathResultTypes = [];
// 通过路由前缀（controller）拆分api放入不同文件下存放
const apiControllerMap = {};
const requestUrls = {};
let exportRequestUrl = "";

// 根据模板生成接口请求方法
const createApisByTemplate = (options, pathObj) => {
  const {
    summary,
    apiName,
    inputParams,
    responseType,
    method,
    path,
    outerData,
    requestConfig,
    headers,
    queryParams,
    innerData,
    pathParams,
  } = pathObj;
  const apiTemplate = fs.readFileSync(options.apisConfig.apiTemplatePath, {
    encoding: "utf-8",
  });
  let str = ""; // 路径是否以a.b格式结尾，即是否使用requestURL
  const urlEndingRegex = /([a-zA-Z0-9.]+)$/;
  const pathParamsStr = pathParams.join(",");
  if (apiTemplate.includes("method:") && apiTemplate.includes("url:")) {
    // 匹配 return至({之间的字符串
    const axiosRegex = /return\s+(.*?)\(/; // 取出return的axios字段
    const axiosStr = apiTemplate.match(axiosRegex)[1] || "axios.request"; // 匹配 url的字符串
    const urlRegex = /url:\s*([^,]+)/;
    let urlStr = apiTemplate.match(urlRegex)[1] || ""; // 路径是否使用requestURL
    if (urlStr && urlEndingRegex.test(urlStr)) {
      const urlStrStart = urlStr.replace(urlStr.match(urlEndingRegex)[1], ""); // 若路径携带参数，则拼接箭头函数
      urlStr = `${urlStrStart}requestURL.${pathParamsStr ? `${apiName}Url(${pathParamsStr})` : apiName + "Url"}`;
    } else {
      urlStr = `\`${path}\``;
    }
    const requestBody = [queryParams, innerData, headers]
      .filter((item) => item)
      .join(", ");
    str = `/**\n* ${summary}\n*/\nexport const ${apiName} = (${inputParams.replace(/data:/g, "params:")})${
      responseType ? `: AxiosPromise<${responseType}>` : ""
    } => {
        return ${axiosStr}({
        url: ${urlStr},
        method: \`${method}\`${outerData ? ",\ndata:params" : ""}${requestBody ? `,${requestBody}` : ""}
        })
    }\n`;
  } else {
    // 取出括号中的数据
    const urlRegex = /\(.*?\)/g;
    const urlParamsStr = apiTemplate.match(urlRegex)[1]; // 匹配是否以(a.b)格式即是否使用requestURL
    const isRequestUrlRegex = /^\((.*)\.(.*)\)$/;
    let urlStr = `\`${path}\``;
    if (urlParamsStr && isRequestUrlRegex.test(urlParamsStr)) {
      urlStr = `requestURL.${pathParamsStr ? `${apiName}Url(${pathParamsStr})` : apiName + "Url"}`;
    }
    str = `/**\n* ${summary}\n*/\nexport const ${apiName} = (${inputParams})${
      responseType ? `: AxiosPromise<${responseType}>` : ""
    } => {
return axios.${method}(${urlStr}${outerData ? ", data" : ""}${requestConfig})
}\n`;
  }
  return str;
};
/**
 * 接口请求生成方法
 * @param {*} options 用户配置选项
 * @param {*} paths 接口请求数据
 * @returns {String}
 */
const handlePaths = (options, paths) => {
  if (
    options.apisConfig &&
    options.apisConfig.apiTemplatePath &&
    !fs.existsSync(options.apisConfig.apiTemplatePath)
  ) {
    log.error("api模版文件不存在");
    return {};
  }
  const urls = Object.keys(paths);
  urls.forEach((url) => {
    const controller = url.split("/")[1];
    let outputFileName = options.apiResultFileName;
    if (options.splitApis) {
      outputFileName = transformFileName(controller);
    } // 初始化对象
    if (!apiControllerMap[outputFileName]) {
      apiControllerMap[outputFileName] = "";
    } // 接口数据对象： url: { 'GET': {GET请求对象}, 'POST': {POST请求对象}}
    const apiObjs = paths[url]; // 'get' | 'post' | 'delete' 请求方式数组
    const methods = Object.keys(paths[url]);
    methods.forEach((method) => {
      // 接口入参
      let inputParams = ""; // post请求body参数
      let outerData = ""; // delete请求头data
      let innerData = ""; // 接口响应数据类型
      let responseType = ""; // 获取当前处理的请求对象
      const apiObj = apiObjs[method]; // 生成请求注释信息
      const summary = apiObj.summary; // 路由中参数形式替换
      const path = url.replaceAll(
        "{",
        "${",
      ); /** 获取path中${xxx-xxx}的内容替换成${xxxXxx} */
      const formatPath = path.replace(/\${([^\}]+)}/g, (_match, p1) => {
        return "${" + formatParamName(p1) + "}";
      }); // 请求名称swagger api会附带方法名
      const apiName = apiObj.operationId.replace(/Using\w*/, ""); // 请求header处理
      const headers = handleAuthType(options, apiName);
      const { requestBody, responses } = apiObj;
      if (requestBody) {
        // 接口入参处理，GET 请求不支持@requestBody
        inputParams = `data: ${handleContentBody(requestBody.content)}`;
        if (["post", "put", "patch"].includes(method)) {
          // POST | PUT | PATCH 请求body参数  post<T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R>;
          outerData = handleContentBody(requestBody.content);
        } else if (method === "delete") {
          // DELETE 请求 config参数 AxiosRequestConfig
          innerData = "data";
        }
      }
      if (responses) {
        // 接口响应数据类型
        responseType = handleResponseType(responses);
      }
      const apiParams = apiObj.parameters;
      if (apiParams) {
        // GET请求 query参数
        inputParams +=
          (inputParams ? ", " : "") +
          handleParameters(apiParams, outputFileName);
      } // 请求接口
      let requestUrlPath = formatPath;
      let pathParams = []; // 接口地址中是否带有参数
      if (formatPath.includes("$")) {
        // 删除入参字符串中的空格并分割成数组
        const requestUrlInputParams = inputParams.replace(/\s/g, "").split(","); // 取出接口地址参数组成数组
        pathParams = requestUrlPath
          .match(/\$\{([^\}]+)\}/g)
          .map((item) => item.slice(2, -1)); // 根据接口地址中的参数过滤接口入参

        const requestUrlParams = requestUrlInputParams.filter((item) =>
          pathParams.includes(item.split(":")[0]),
        ); // 接口地址函数
        requestUrlPath = `(${requestUrlParams.join(",")})=>\`${formatPath}\``;
      }
      requestUrls[apiName + "Url"] = requestUrlPath; // 生成请求参数
      const queryParams = generateQueryParams(apiParams); // 生成请求配置
      const requestConfig = generateRequestConfig(
        queryParams,
        innerData,
        headers,
      );
      let expression = "";
      if (options.apisConfig && options.apisConfig.apiTemplatePath) {
        // 有api模版链接
        let pathObj = {
          method,
          formatPath,
          inputParams,
          outerData,
          responseType,
          summary,
          requestConfig,
          apiName,
          headers,
          queryParams,
          innerData,
          pathParams,
        };
        expression = createApisByTemplate(options, pathObj);
      } else {
        expression = `/**\n* ${summary}\n*/\nexport const ${apiName} = (${inputParams})${
          responseType ? `: AxiosPromise<${responseType}>` : ""
        } => {
  return axios.${method}(\`${formatPath}\`${outerData ? ", data" : ""}${requestConfig})
}\n`;
      }
      apiControllerMap[outputFileName] += expression;
    });
  }); // 生成请求地址
  let requestUrlsStr = transformString(JSON.stringify(requestUrls)); // 请求地址换行
  requestUrlsStr = requestUrlsStr.replace(/,/g, ",\n"); // 导出请求地址
  exportRequestUrl = `export const requestUrls =${requestUrlsStr}`;
  return {
    requestUrls: exportRequestUrl,
    pathResult: apiControllerMap,
  };
};

// url链接参数引号处理
const transformString = (str) => {
  const regex = /"([^"]+)":"([^"]+)"/g;
  let result = str.replace(regex, (_match, p1, p2) => {
    let inputParams = "";
    let pathUrl = p2;
    if (p2.includes("=>")) {
      inputParams = p2.split("=>")[0] + "=>";
      pathUrl = p2.split("=>")[1].replace(/`/g, "");
    }
    return p1 + ":" + inputParams + "`" + pathUrl + "`";
  });
  return result;
};
// 首字母大写
const upperName = (propertyName) => {
  return propertyName.slice(0, 1).toUpperCase() + propertyName.slice(1) + "";
};
// xx-xx文件名转换成xxXx
const transformFileName = (fileName) => {
  return fileName
    .split("-")
    .map((item, index) => {
      return index ? upperName(item) : item;
    })
    .join("");
};

const generateRequestConfig = (queryParams, innerData, headers) => {
  let result = [queryParams, innerData, headers]
    .filter((item) => item)
    .join(", ");
  return result ? `, {${result}}` : "";
};

const handleAuthType = (options, apiName) => {
  const { realName, optional, anonymous } = options.apisConfig;
  if (realName && realName.includes(apiName)) {
    return `headers: { 'Auth-Type': 'real-name' }`;
  } else if (optional && optional.includes(apiName)) {
    return `headers: { 'Auth-Type': 'optional' }`;
  } else if (anonymous && anonymous.includes(apiName)) {
    return `headers: { 'Auth-Type': 'anonymous' }`;
  } else {
    return "";
  }
};

const handleContentBody = (content) => {
  if (content["application/json"]?.schema?.type) {
    return handleRequestSchemaType(content["application/json"].schema);
  } else if (content["application/json"]?.schema["$ref"]) {
    return handleRequestSchemaRef(content["application/json"].schema["$ref"]);
  } else {
    return `{ ${handleRequestProperties(content["multipart/form-data"].schema.properties)} }`;
  }
};

const handleResponseType = (responses) => {
  const content = responses["200"].content;
  if (content && content["*/*"]) {
    return handleResponseSchema(content["*/*"].schema);
  } else {
    return "";
  }
};

const handleResponseSchema = (schema) => {
  if (schema.type) {
    switch (schema.type) {
      case "integer":
        return "number";
      case "boolean":
        return "boolean";
      case "string":
        return "string";
      case "object":
        if (schema.additionalProperties) {
          return `{[key: string]: ${handleResponseSchema(schema.additionalProperties)}}`;
        } else {
          return "unknown";
        }
      case "array":
        if (schema.items.$ref) {
          return `${handleRequestSchemaRef(schema.items.$ref)}[]`;
        } else if (schema.items.type) {
          return `${handleResponseSchema(schema.items)}[]`;
        } else {
          return "unknown[]";
        }
      default:
        return "unknown";
    }
  } else if (schema.$ref) {
    return `${handleRequestSchemaRef(schema.$ref)}`;
  } else {
    return "";
  }
};

const handleRequestSchemaRef = (schemaRef) => {
  return handleNameIndex(schemaRef.replace("#/components/schemas/", ""));
};

const handleRequestProperties = (propertiesMap) => {
  const propertyNames = Object.keys(propertiesMap);
  return propertyNames
    .map((item) => {
      return `${item}: ${propertiesMap[item].type}`;
    })
    .join(", ");
};

const handleRequestSchemaType = (schema) => {
  switch (schema.type) {
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "string":
      return "string";
    case "array":
      if (!schema.items) {
        return "unknown[]";
      } else if (schema.items.type) {
        return `${handleRequestSchemaType(schema.items)}[]`;
      } else if (schema.items.$ref) {
        return `${handleRequestSchemaRef(schema.items.$ref)}[]`;
      } else {
        return "unknown[]";
      }
    default:
      return "unknown";
  }
};

/** 格式化命名（去除“-”连接字符串） */
const formatParamName = (name) => {
  if (name && name.includes("-")) {
    const strArr = name.split("");
    const targetIndex = strArr.findIndex((item) => item === "-");
    strArr[targetIndex + 1] = strArr[targetIndex + 1].toUpperCase();
    strArr.splice(targetIndex, 1);
    return strArr.join("");
  } else {
    return name;
  }
};

const handleParameters = (parameters, outputFileName) => {
  if (parameters) {
    let result = "";
    parameters &&
      parameters
        .sort((a, b) => {
          return a.required && !b.required ? -1 : 0;
        })
        .forEach((item, index) => {
          const formatName = formatParamName(item.name);
          result += `${index ? ", " : ""}${formatName}${item.required ? "" : "?"}: ${generateParameterType(
            formatName,
            item.schema,
            outputFileName,
          )}`;
        });
    return result;
  } else {
    return "";
  }
};

const generateQueryParams = (parameters) => {
  if (parameters) {
    // GET请求query参数最终生成{ query: {param1, param2}}，param1由传参解构传入
    const result = parameters
      .filter((item) => item.in === "query")
      .map((item) => item.name)
      .join(", ");
    return result ? `params: {${result}}` : "";
  } else {
    return "";
  }
};

const generateParameterType = (typeName, schema, outputFileName) => {
  switch (schema.type) {
    case "integer":
      return "number";
    case "string":
      return handleStringType(typeName, schema, outputFileName);
    case "boolean":
      return "boolean";
    case "array":
      return handleArrayType(schema);
    default:
      return "unknown";
  }
};

const handleStringType = (propertyName, schema, outputFileName) => {
  if (schema.enum) {
    // 枚举类型首字母大写
    propertyName =
      propertyName.slice(0, 1).toUpperCase() + propertyName.slice(1) + "";
    if (pathResultTypes.includes(propertyName)) {
      // 如已经生成过该枚举类型则直接引用
      return propertyName;
    } // 否则定义该枚举类型并标识已生成
    let result = `export type ${propertyName} = `;
    schema.enum.forEach((item, index) => {
      result += `${index ? " | " : ""}'${item}'\n`;
    });
    pathResultTypes.push(propertyName);
    apiControllerMap[outputFileName] += result;
    return propertyName;
  } else {
    return "string";
  }
};

const handleArrayType = (schema) => {
  if (schema.item && schema.item.$ref) {
    return "string[]";
  } else {
    return "unknown[]";
  }
};

module.exports = {
  /**
   * Path字段解析处理函数
   */
  handlePaths,
};
