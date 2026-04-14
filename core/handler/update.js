const fs = require('fs');
const path = require('path');

/**
 * 更新target.d.ts文件中的可空字段和忽略注释
 * @param {string} templatePath template.d.ts文件路径
 * @param {string} targetPath target.d.ts文件路径
 */
function updateNullableFields(templateContent, targetContent) {
    // 1. 从template中提取所有可空字段
    const nullableFields = extractNullableFields(templateContent);
    // 2. 从template中提取所有忽略注释
    const ignoreComments = extractIgnoreComments(templateContent);

    // 3. 更新target文件中的接口定义
    const updatedContent = updateTargetContent(targetContent, nullableFields, ignoreComments);

    // 4. 写回target文件
    return updatedContent;
}

/**
 * 从内容中提取所有可空字段
 * @param {string} content 文件内容
 * @returns {Object} 以接口名为key，字段数组为value的对象
 */
function extractNullableFields(content) {
    const result = {};
    // 匹配interface定义和字段
    const interfaceRegex = /interface\s+(\w+)\s*{([^}]+)}/g;
    const fieldRegex = /(\w+)(\?:\s*([^;\s]+)|\s*:\s*([^|;]+)\s*\|\s*null\s*;?)/g;

    let interfaceMatch;
    while ((interfaceMatch = interfaceRegex.exec(content)) !== null) {
        const interfaceName = interfaceMatch[1];
        const interfaceBody = interfaceMatch[2];
        result[interfaceName] = {};

        let fieldMatch;
        while ((fieldMatch = fieldRegex.exec(interfaceBody)) !== null) {
            const fieldName = fieldMatch[1];
            const nullableMarker = fieldMatch[2].includes('?') ? '?:' : '| null';
            result[interfaceName][fieldName] = nullableMarker;
        }
    }

    return result;
}

/**
 * 从内容中提取所有忽略注释
 * @param {string} content 文件内容
 * @returns {Object} 以接口名为key，字段数组为value的对象
 */
function extractIgnoreComments(content) {
    const result = {};
    const interfaceRegex = /interface\s+(\w+)\s*{([^}]+)}/g;
    const ignoreRegex = /\/\/\s*@ignore:\s*(\w+)\s*\n\s*(\w+)\s*:\s*([^;]+);\s*(\/\/.*)?/g;

    let interfaceMatch;
    while ((interfaceMatch = interfaceRegex.exec(content)) !== null) {
        const interfaceName = interfaceMatch[1];
        const interfaceBody = interfaceMatch[2];
        result[interfaceName] = {};

        let ignoreMatch;
        while ((ignoreMatch = ignoreRegex.exec(interfaceBody)) !== null) {
            const ignoreType = ignoreMatch[1];
            const fieldName = ignoreMatch[2];
            const fieldType = ignoreMatch[3];
            const originalComment = ignoreMatch[4] || '';
            result[interfaceName][fieldName] = {
                ignoreType,
                fieldType,
                originalComment
            };
        }
    }

    return result;
}

/**
 * 更新target文件内容，添加可空标识和保留忽略注释
 * @param {string} content target文件内容
 * @param {Object} nullableFields 可空字段信息
 * @param {Object} ignoreComments 忽略注释信息
 * @returns {string} 更新后的内容
 */
function updateTargetContent(content, nullableFields, ignoreComments) {
    return content.replace(/interface\s+(\w+)\s*{([^}]+)}/g, (match, interfaceName, interfaceBody) => {
        if (!nullableFields[interfaceName] && !ignoreComments[interfaceName]) {
            return match;
        }

        // 对每个字段进行处理
        const updatedBody = interfaceBody.split('\n').map(line => {
            const fieldMatch = line.match(/^\s*(\w+)\s*:\s*([^;]+);\s*(\/\/.*)?/);
            if (!fieldMatch) return line;

            const fieldName = fieldMatch[1];
            const fieldType = fieldMatch[2].trim();
            const existingComment = fieldMatch[3] || '';

            // 处理忽略注释
            if (ignoreComments[interfaceName]?.[fieldName] && fieldType === ignoreComments[interfaceName][fieldName].ignoreType) {
                const comment = ignoreComments[interfaceName][fieldName].originalComment || existingComment;
                return `  // @ignore: ${ignoreComments[interfaceName][fieldName].ignoreType}\n  ${fieldName}: ${ignoreComments[interfaceName][fieldName].fieldType};${comment ? ' ' + comment : ''}`;
            }

            // 处理可空字段
            if (nullableFields[interfaceName]?.[fieldName]) {
                const nullableMarker = nullableFields[interfaceName][fieldName];
                // 如果字段已经是可空的，则不处理
                if (line.includes('?:') || line.includes('| null')) {
                    return line;
                }
                // 否则添加可空标识
                if (nullableMarker === '?:') {
                    return line.replace(
                        /(\w+)\s*:\s*([^;]+)(;.*)?/,
                        (_, name, type, comment) => `${name}?: ${type}${comment || ''}`
                    );
                } else {
                    return line.replace(
                        /(\w+)\s*:\s*([^;]+)(;.*)?/,
                        (_, name, type, comment) => `${name}: ${type} | null${comment || ''}`
                    );
                }
            }
            return line;
        }).join('\n');

        return `interface ${interfaceName} {${updatedBody}}`;
    });
}


module.exports = {
  updateNullableFields,
}