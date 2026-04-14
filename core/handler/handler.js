let interfaceStr = '';
let stringTypes = {};
let globalDecalreFlag = false;
let globalNameIndex = '';

const makeInterface = (nameIndex, properties, options) => {
  globalNameIndex = nameIndex;
  const { readonly, interfacesConfig } = options;
  const { optional = false, global = false } = interfacesConfig || {};
  globalDecalreFlag = global;
  interfaceStr = '';
  let propertyStr = '';
  if (properties && typeof properties === 'object') {
    for (let propertyName in properties) {
      const data = properties[propertyName];
      const description = `${data['$ref'] || data.description || ''}`;
      const propertyTypeStr = handlePropertyType(data, propertyName);
      propertyStr += `\n  ${(readonly ? 'readonly ' : '') + propertyName}${handleOptionalPropertyName(
        optional,
        propertyName,
        data.required,
      )}: ${propertyTypeStr};${description ? '  // ' + description : ''}`;
    }
  }
  // 如果开启全局interface,则不导出
  interfaceStr += `${globalDecalreFlag ? '' : 'export '}interface ${handleNameIndex(nameIndex)} {${propertyStr}\n}\n`;
  return interfaceStr;
};

// 根据配置处理可选字段
const handleOptionalPropertyName = (optional, propertyName, required) => {
  const type = typeof optional;
  if (required === false) {
    return '?';
  }
  switch (type) {
    case 'boolean':
      return optional ? '?' : '';
    case 'object':
      return optional instanceof Array && optional.includes(propertyName) ? '?' : '';
    default:
      return '';
  }
};

// 去除VO typename前后的箭头标记
const handleNameIndex = (nameIndex) => {
  // 正则匹配仅保留数字+字母
  const reg = /[a-zA-Z0-9]/g;
  return nameIndex.match(reg).join('');
};

// 生成typename首字母大写
const upperProperName = (propertyName) => {
  return propertyName.slice(0, 1).toUpperCase() + propertyName.slice(1) + '';
};

const handlePropertyType = (data, propertyName) => {
  if (data.type) {
    switch (data.type) {
      case 'integer':
        return 'number';
      case 'array':
        return handleArrayData(data, propertyName);
      case 'string':
        return handleStringData(data, propertyName);
      case 'object':
        return handleObjectData(data, propertyName);
      default:
        return data.type;
    }
  } else if (data['$ref']) {
    return `${handleRefData(data['$ref'])}`;
  } else {
    return 'unknown';
  }
};

const handleArrayData = (data, propertyName) => {
  if (data.items && data.items.type && data.items.enum) {
    return handleStringData(data.items, propertyName) + '[]';
  } else if (data.items && data.items.type && !data.items.enum) {
    return data.items.type + '[]';
  } else if (data.items && data.items['$ref']) {
    return `${handleRefData(data.items['$ref'])}[]`;
  } else {
    return 'unknown[]';
  }
};

const handleStringData = (data, propertyName) => {
  const typeName = upperProperName(propertyName);
  if ((stringTypes[typeName]) && data.enum) {
    try {
      // 判断是否存在相同枚举类型，由于二者是对象类型，需要转换成字符串进行比较
      const exitedTypes = JSON.stringify(stringTypes[typeName]);
      const dataTypes = JSON.stringify(data.enum);
      if (exitedTypes === dataTypes) {
        // 如果枚举类型相同，则直接返回
        return typeName;
      } else {
        // 如果枚举类型不同，则生成新的枚举类型，且枚举类型命名修改为对象名去除VO/Command/DTO后缀 + 枚举类型名
        const newTypeName = globalNameIndex.replaceAll('VO', '').replaceAll('Command', '').replaceAll('DTO', '') + typeName;
        return handleStringData(data, newTypeName);
      }
    } catch (error) {
      return typeName;
    }
  } else if (data.enum) {
    stringTypes[typeName] = data.enum;
    return generateTypes(propertyName, data.enum);
  } else {
    return 'string';
  }
};

const handleRefData = (data) => {
  const dataArr = data.split('/');
  // 时间模块缺失，数据类型应属于string
  if (dataArr[dataArr.length - 1].toString() === `Error-ModelName{namespace='java.time', name='LocalDate'}`) {
    return 'string';
  } else if (dataArr[dataArr.length - 1].toString().includes('Error')) {
    // 其他模块缺失导致的类型无法获取
    return 'unknown';
  }
  return dataArr[dataArr.length - 1].replaceAll('«', '').replaceAll('»', '');
};

const handleObjectData = (data, propertyName) => {
  if (data.additionalProperties) {
    return `Record<string, ${handlePropertyType(data.additionalProperties, propertyName)}>`
  } else {
    return 'object';
  }
};

const generateTypes = (typeName, enums) => {
  const TypeName = upperProperName(typeName);
  let enumStr = '';
  enums.forEach((type) => {
    enumStr += `\n | '${type}'`;
  });
  // 如果开启全局interface,则不导出
  const result = `${globalDecalreFlag ? '' : 'export '}type ${TypeName} =${enumStr};\n`;
  interfaceStr = result + interfaceStr;
  return `${TypeName}`;
};


module.exports = {
  makeInterface,
  handleNameIndex,
};