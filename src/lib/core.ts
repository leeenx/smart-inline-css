import { eventBus } from './event-bus';

/**
 * smart-inline-css 是一个内联样式的管理框架，
 * 它内部实现「选择器」的功能，当前支持的选择器有：
 * 类选择器、元素选择器、无类选择器、before & after 伪元素选择器和通配符
 */

type Props = Record<string, any>;
export interface StyleFnArgs {
  currentArrayLen: number;
  currentIndex: number;
  isEmpty: boolean;
  isEven: boolean;
  isOdd: boolean;
  isFirst: boolean;
  isLast: boolean;
  isOnlyChild: boolean;
  currentClassList: string[];
  parentClassList: string[][];
  siblingClassList: string[][];
  parentMemoId: string;
  parentPropsList: Props[];
  siblingPropsList: Props[];
  childPropsList: Props[];
  props: Props;
  sourceComponentName: string;
}

export type PureStyle = Record<string, string | number>;
type FnStyle = (index?: number, styleFnArgs?: StyleFnArgs) => PureStyle | undefined;
interface StyleMapStyle {
  [key: string]: string | number | PureStyle | FnStyle | StyleMapStyle
}
type Style = StyleMapStyle | FnStyle;
type CascadeStyleItem = {
  key: string;
  parent: string[];
  weight: number;
  checkSelector: (styleFnArgs: StyleFnArgs) => boolean;
  style?: PureStyle;
};
type CascadeStyleSet = Record<string, CascadeStyleItem[]>;
type CascadeFnStyleItem = {
  key: string;
  parent: string[];
  weight: number;
  checkSelector: (styleFnArgs: StyleFnArgs) => boolean;
  styleFn?: FnStyle;
};
type CascadeFnStyleSet = Record<string, CascadeFnStyleItem[]>;

export type StyleSet = Record<string, Style>;

type ComplexExec = (index?: number, styleFnArgs?: StyleFnArgs) => boolean;
type ComplexSelectorType = ':not' | ':has' | ':not:has' | ':has:not' | ':nth-child' | ':first-child' | ':last-child' | ':only-child' | ':empty' | 'attribute-selector';

// 全局样式里的 cascadeStyle
const globalCascadeStyleSet: CascadeStyleSet= {};

// 全局样式里的 cascadeFnStyle
const globalCascadeFnStyleSet: CascadeFnStyleSet = {};

// 局域样式集
const localCascadeStyleSetMap: Record<string, CascadeStyleSet> = {};
const localCascadeFnStyleSetMap: Record<string, CascadeFnStyleSet> = {};

// 遍历 childPropsList
const travelChildPropsList = (childPropsList: Props[], callback: (index: number, styleFnArgs: StyleFnArgs) => boolean) => {
  const grandsonPropsList: Props[] = [];
  // 广度优先
  if (!childPropsList.some(childProps => {
    if (childProps?.$$extrainfo$$?.childPropsList?.length) {
      grandsonPropsList.push(...childProps.$$extrainfo$$.childPropsList);
    }
    return callback(childProps.$$extrainfo$$?.currentIndex, childProps.$$extrainfo$$);
  })) {
    // 没找到，进入孙级
    return grandsonPropsList?.length ? travelChildPropsList(grandsonPropsList, callback) : false;
  }
  return true;
};


// 按权重添加
const addStyleItemByWeight = (
  item: CascadeStyleItem,
  cascadeList: CascadeFnStyleItem[] | CascadeStyleItem[]
) => {
  const lastIndex = cascadeList.length - 1;
  for(let i = lastIndex; i >=  0; --i) {
    const cascadeFnStyleItem = cascadeList[i];
    if (item.weight >= cascadeFnStyleItem.weight) {
      // 插在当前位置后面
      cascadeList.splice(i + 1, 0, item);
      break;
    }
  }
};

// 添加级联样式
const addCascadeStyle = (
  key: string,
  item: CascadeStyleItem,
  cascadeStyleSet: CascadeStyleSet, // 级联纯样式集
) => {
  if (!cascadeStyleSet[key]) {
    cascadeStyleSet[key] = [item];
  }
  else {
    const cascadeStyleList = cascadeStyleSet[key];
    addStyleItemByWeight(item, cascadeStyleList);
  }
};

// 添加函数类级联样式
const addCascadeFnStyle = (
  key: string,
  item: CascadeFnStyleItem,
  cascadeFnStyleSet: CascadeFnStyleSet, // 级联函数类样式集
) => {
  if (!cascadeFnStyleSet[key]) {
    cascadeFnStyleSet[key] = [item];
  }
  else {
    const cascadeFnStyleList = cascadeFnStyleSet[key];
    addStyleItemByWeight(item, cascadeFnStyleList);
  }
};

// 按路径生成对象
const createStyleByPath = (paths: string[], style: Style) => {
  const obj: Style = {};
  let sub: Style = obj;
  const lastIndex = paths.length - 1;
  paths.forEach((path, index) => {
    sub[path] = lastIndex === index ? style : {};
    sub = sub[path];
  });
  return obj;
};

// 从特殊处理的 selector 字符中，返回正确的 selector
const getKeysFromSelector = (selector: string, attributeSelectors: string[]) => {
  return selector.split(/\s+/).map((selectorItem) => {
    let key = selectorItem;
    attributeSelectors.forEach((attributeSelector, index) => {
      key = key.replace(`$$ATTR_REPLACE_SYMBOL$$#${index}#`, attributeSelector);
    });
    return key;
  });
};

/**
 * 将 key 为【a b c】转换成【{a: { b: { c } }}】层级
 */
const resolveShortKey = (sourceStyleSet: StyleSet) => {
  const targetStyleSet: StyleSet = {};
  Object.entries(sourceStyleSet).forEach(([key, style]) => {
    if (['function', 'object'].includes(typeof style)) {
      // 样式集的 key 才具体语法糖
      const styleSet = typeof style === 'function' ? style : resolveShortKey(style as StyleSet);
      let selector = key;
      // 属性选择器是否包含空格的正则
      const attributeSelectors: string[] = [];
      if (attributeSelectorRegExp.test(selector)) {
        selector = selector.replace(attributeSelectorRegExp, (attributeSelector: string) => {
          const attrReplaceSymbol = `$$ATTR_REPLACE_SYMBOL$$#${attributeSelectors.length}#`;
          attributeSelectors.push(attributeSelector);
          return attrReplaceSymbol;
        });
      }
      if (selector.indexOf(' ') !== -1) {
        // 带空格，需要做层级处理
        const [firstKey, ...otherKeys] = getKeysFromSelector(selector, attributeSelectors);
        if (!targetStyleSet[firstKey]) {
          targetStyleSet[firstKey] = {};
        }
        Object.assign(targetStyleSet[firstKey], createStyleByPath(otherKeys, styleSet));
      } else {
        targetStyleSet[key] = styleSet;
      }
    } else {
      targetStyleSet[key] = sourceStyleSet[key];
    }
  });
  return targetStyleSet;
};

// 还原带 & 与 &: 的 key
const resolveParentSymbol = (sourceStyleSet: StyleSet, parentKey?: string, parentSyleSet?: StyleSet) => {
  Object.entries(sourceStyleSet).forEach(([key, style]) => {
    if (['function', 'object'].includes(typeof style)) {
      // 需要对 style 进行处理
      resolveParentSymbol(style as StyleSet, key, sourceStyleSet);
    }
    let selector = key;
    // 属性选择器是否包含 & 的正则
    const regExp = /\[[^\]]*&+[^\]]*\]/g;
    const attributeSelectors: string[] = [];
      if (regExp.test(selector)) {
        selector = selector.replace(regExp, (attributeSelector: string) => {
          const attrReplaceSymbol = `$$ATTR_REPLACE_SYMBOL$$#${attributeSelectors.length}#`;
          attributeSelectors.push(attributeSelector);
          return attrReplaceSymbol;
        });
      }
    if (selector.indexOf('&') !== -1) {
      if (!parentKey || !parentSyleSet) {
        console.warn('语法错误：没有父级，不允许使用 &');
      } else {
        // 新key
        let newKey = selector.replace(/&/g, parentKey);
        attributeSelectors.forEach((attributeSelector, index) => {
          newKey = newKey.replace(`$$ATTR_REPLACE_SYMBOL$$#${index}#`, attributeSelector);
        });
        if (selector.indexOf('&:') !== -1 || selector.indexOf('&[') !== -1) {
          // :nth-child、:not、:has 这些伪类需要做层级上提
          parentSyleSet[newKey] = style;
        } else {
          sourceStyleSet[newKey] = style;
        }
      }
      // 删除key
      delete sourceStyleSet[key];
    }
  });
};

// 将原始的样式集转换成标准格式
const parseStyleSet = (sourceStyleSet: StyleSet) => {
  // 从 sourceStyleSet 生成一份新的样式集
  const targetStyleSet = resolveShortKey(sourceStyleSet);
  // 直接处理 targetStyleSet，替换 &
  resolveParentSymbol(targetStyleSet);
  return targetStyleSet;
};

const attributeSelectorRegExp = /(\[[^\]]+\])|(\[[^\]=]+=[^\]]+\])|(\[[^\]=]+="[^"]+"\])/g;

// 是否为复杂选择器
const isComplexSelector = (selector: string) => {
  // 属性选择器属于复杂选择器
  if (attributeSelectorRegExp.test(selector)) {
    return true;
  }
  /**
   * 支持的伪类:
   * :not、:has、:nth-child、:first-child、:last-child、:only-child 与 :empty
   */
  if (/:(not|has|nth-child|first-child|last-child|only-child|empty)/g.test(selector)) {
    return true;
  }
  return false;
};

const uniqueMap: Record<string, number> = {};
const uniqueKeyToSelectorMap: Record<string, string> = {};
let uniqueIndex = 0;
const genUniqueKey = (token: string) => {
  let index = uniqueMap[token];
  if (!index) {
    uniqueMap[token] = ++uniqueIndex;
    index = uniqueIndex;
  }
  const uniqueKey = `@@COMPLEX_SELECTOR_KEY_${index}@@`;
  uniqueKeyToSelectorMap[uniqueKey] = token;
  return uniqueKey;
};

const getExecFromUniqueKey = (key: string) => {
  const selector = uniqueKeyToSelectorMap[key];
  return complexExecMap[selector];
};

const complexExecMap: Record<string, ComplexExec> = {};
const complexSelectorWeight: Record<string, number> = {};
const complexSelectorBaseNameMap: Record<string, string> = {};
// 复杂选择器转函数
const getExecFromComplexSelector = (complexSelector: string, type?: ComplexSelectorType, getIncreWeight?: (increWeight: number) => void) => {
  let exec = complexExecMap[complexSelector];
  let weight = complexSelectorWeight[complexSelector] || 0;
  if (!exec) {
    if (!type) {
      // 获取基础类，如果没有就是通配符 *
      let className = '*';
      let selector = complexSelector.replace(/^[_\w\-]+/, (str) => {
        className = str;
        return '';
      });
      if (className !== '*') {
        // 有类名权重变成1
        weight = 1;
      }
      complexSelectorBaseNameMap[complexSelector] = className;
      // 基础类名检查
      const checkClassName = (index: number, styleFnArgs?: StyleFnArgs) => {
        return Boolean(styleFnArgs?.currentClassList?.includes(className));
      };

      if (!/@@COMPLEX_SELECTOR_KEY_\d+@@/.test(selector)) {
        // 原始的选择器，需要处理
        const replaceHandler = (matchedItem: string, type: ComplexSelectorType = matchedItem as ComplexSelectorType) => {
          const uniqueKey = genUniqueKey(matchedItem);
          // 预生成函数
          getExecFromComplexSelector(matchedItem, type, (increWeight) => weight += increWeight);
          return uniqueKey;
        };
  
        // 属性选择器的内容不可控，需要先把它替换出来
        selector = selector.replace(attributeSelectorRegExp, (matchedItem) => replaceHandler(matchedItem, 'attribute-selector'));
        // 替换四个基础伪类
        selector = selector.replace(/(:first-child)|(:last-child)|(:only-child)|(:empty)/g, (matchedItem) => replaceHandler(matchedItem));
        // 替换 nth-child
        selector = selector.replace(/:nth-child\(.+\)/g, (matchedItem) => replaceHandler(matchedItem, ':nth-child'));
        // 替换 :has(:not(*)) 与 :not(:has(*))
        selector = selector.replace(/:has\(:not\([^\)]+\)\)/g, (matchedItem) => replaceHandler(matchedItem, ':has:not'));
        selector = selector.replace(/:not\(:has\([^\)]+\)\)/g, (matchedItem) => replaceHandler(matchedItem, ':not:has'));
        // 替换 :not
        selector = selector.replace(/:not\([^\)]+\)/g, (matchedItem) => replaceHandler(matchedItem, ':not'));
        // 替换 :has
        selector = selector.replace(/:has\([^\)]+\)/g, (matchedItem) => replaceHandler(matchedItem, ':has'));
      }
      // 生成一个调用链
      const execChain: ComplexExec[] = [checkClassName];
      selector.match(/@@COMPLEX_SELECTOR_KEY_\d+@@/g)?.forEach(matchedItem => {
        execChain.push(getExecFromUniqueKey(matchedItem));
      });
      exec = (index: number, styleFnArgs: StyleFnArgs) => execChain.every(execItem => execItem(index, styleFnArgs));
    } else {
      if (type !== ':not') {
        // :not 不计入权重
        weight += 1;
      }
      // 按类型生成对应的函数
      switch(type) {
        case ":nth-child": {
          // nth-child 的语法很简单就是：kn/kn+m/kn-n
          const expression = complexSelector.replace(/:nth-child\((.+)\)/, '$1');
          if (/^\d+$/.test(expression)) {
            // 纯数字
            exec = (index: number) => index === Number(expression);
          } else if (/^\d*n$/.test(expression)) {
            // kn 形式
            const count = parseInt(expression);
            exec = (index: number) => index % count === 0;
          } else if(/^\d*n(\+|-)\d+$/.test(expression)) {
            const [kn = '', operator, lastNumber] = expression.match(/(\d*n)|(\+|-)|(\d+)/g) || [];
            const k = parseInt(kn) || 1;
            exec = (index: number) => {
              if (operator === '+') {
                return (index % k) - Number(lastNumber) === 0;
              }
              return (index % k) + Number(lastNumber) === 0;
            }
          } else {
            exec = (index: number, styleFnArgs: StyleFnArgs) => false;
          }
          break;
        }
        case ":first-child":
          exec = (index: number, styleFnArgs: StyleFnArgs) => styleFnArgs.isFirst;
          break;
        case ":last-child":
          exec = (index: number, styleFnArgs: StyleFnArgs) => styleFnArgs.isLast;
          break;
        case ":only-child":
          exec = (index: number, styleFnArgs: StyleFnArgs) => styleFnArgs.isOnlyChild;
          break;
        case ":empty":
          exec = (index: number, styleFnArgs: StyleFnArgs) => styleFnArgs.isEmpty;
          break;
        case ":not": {
          const expression = complexSelector.replace(/:not\(([^\)]+)\)/, '$1');
          const conditionExec = getExecFromComplexSelector(expression, undefined, (increWeight) => weight += increWeight);
          exec = (index: number, styleFnArgs: StyleFnArgs) => {
            return !conditionExec(index, styleFnArgs);
          }
          break;
        }
        case ":has": {
          const expression = complexSelector.replace(/:has\(([^\)]+)\)/, '$1');
          const conditionExec = getExecFromComplexSelector(expression, undefined, (increWeight) => weight += increWeight);
          exec = (index: number, styleFnArgs: StyleFnArgs) => {
            return travelChildPropsList(styleFnArgs.childPropsList, conditionExec);
          };
          break;
        }
        // :not(:has()) 与 :has(:not())是等价的
        case ':has:not':
        case ':not:has': {
          const expression = (
            type === ':has:not'
              ? complexSelector.replace(/:has\(:not\(([^\)]+)\)\)/, '$1')
              : complexSelector.replace(/:not\(:has\(([^\)]+)\)\)/, '$1')
          );
          const conditionExec = getExecFromComplexSelector(expression, undefined, (increWeight) => weight += increWeight);
          exec = (index: number, styleFnArgs: StyleFnArgs) => {
            return !travelChildPropsList(styleFnArgs.childPropsList, conditionExec);
          };
          break;
        }
        // 属性选择器
        case 'attribute-selector': {
          const selector = complexSelector.replace(/^\[|\]$/g, '');
          const operator = selector.match(/(\*|\^|\$)?=/)?.[0];
          const [attrName, rawAttrValue] = operator ? selector.split(operator) : [];
          const attrValue = rawAttrValue.replace(/^["']|["']$/g, '');
          switch (operator) {
            case '=':
              exec = (index: number, styleFnArgs: StyleFnArgs) => styleFnArgs.props?.[attrName] === attrValue;
              break;
            case '*=':
              exec = (index: number, styleFnArgs: StyleFnArgs) =>  styleFnArgs.props?.[attrName].includes(attrValue);
              break;
            case '^=':
              exec = (index: number, styleFnArgs: StyleFnArgs) =>  new RegExp(`^${attrName}`).test(styleFnArgs.props?.[attrName]);
              break;
            case '$=':
              exec = (index: number, styleFnArgs: StyleFnArgs) =>  new RegExp(`${attrName}$`).test(styleFnArgs.props?.[attrName]);
              break;
            default:
              exec = (index: number, styleFnArgs: StyleFnArgs) => styleFnArgs.props?.hasOwnProperty(selector);
          }
          break;
        }
      }
    }
    // 缓存数据
    complexExecMap[complexSelector] = exec;
    complexSelectorWeight[complexSelector] = weight;
  }
  getIncreWeight?.(weight);
  return exec;
};

// 返回选择器的权重
const getSelectorWeight = (selector: string) => {
  if (selector === '*') return 0;
  let weight = complexSelectorWeight[selector];
  if (weight === undefined) {
    // 没有找到权重
    getExecFromComplexSelector(selector, undefined, (increWeight) => weight = increWeight)
  }
  return weight;
};

// 返回复杂选择器的基础类名
const getBaseClassName = (selector: string) => {
  let className = complexSelectorBaseNameMap[selector];
  if (!className) {
    getExecFromComplexSelector(selector);
    className = complexSelectorBaseNameMap[selector];
  }
  return className;
};

const createCheckSelector = (selector: string) => {
  if (isComplexSelector(selector)) {
    const checkSelector = getExecFromComplexSelector(selector);
    return (styleFnArgs: StyleFnArgs) => {
      return checkSelector(styleFnArgs.currentIndex, styleFnArgs);
    };
  }
  // 【类】选择器
  return (styleFnArgs: StyleFnArgs) => {
    // Fragment 没有任何属性
    return Boolean(styleFnArgs.currentClassList?.includes(selector));
  }
}

// 提取所有的级联样式集
const pickCascadeStyleSet = (
  sourceStyleSet: StyleSet, // 源样式集
  cascadeStyleSet: CascadeStyleSet, // 级联纯样式集
  cascadeFnStyleSet: CascadeFnStyleSet, // 级联函数类样式集
) => {
  const categorize = (style: Style, weight: number = 0, pureStyle?: PureStyle, parent: string[] = []) => {
    const nextParent = [...parent];
    Object.entries(style).forEach(([styleKey, styleValue]) => {
      if (['>', '+', '~'].includes(styleKey)) {
        // 关系符
        console.log('===== 关系符', styleKey);
      }
      if (typeof styleValue === 'function') {
        const currentWeight = weight + getSelectorWeight(styleKey);
        const baseClassName = getBaseClassName(styleKey);
        addCascadeFnStyle(baseClassName, {
          key: styleKey,
          parent: nextParent,
          weight: currentWeight,
          checkSelector: createCheckSelector(styleKey),
          styleFn: styleValue as FnStyle,
        }, cascadeFnStyleSet);
      } else if (typeof styleValue === 'object') {
        // 级联
        const currentWeight = weight + getSelectorWeight(styleKey);
        const baseClassName = getBaseClassName(styleKey);
        const curPureStyle: PureStyle = {};
        nextParent.push(styleKey);
        categorize(styleValue as Style, currentWeight, curPureStyle, nextParent);
        nextParent.pop();
        if (Object.keys(curPureStyle).length) { // 非空样式
          addCascadeStyle(baseClassName, {
            key: styleKey,
            parent: nextParent,
            weight: currentWeight,
            checkSelector: createCheckSelector(styleKey),
            style: curPureStyle,
          }, cascadeStyleSet);
        }
      } else if (pureStyle) {
        pureStyle[styleKey] = styleValue as string;
      }
    });
  };
  categorize(sourceStyleSet);
};

// 全局样式
export const setGlobalStyle = (styleSet: StyleSet) => {
  // 提取出纯样式与nth函数
  pickCascadeStyleSet(parseStyleSet(styleSet), globalCascadeStyleSet, globalCascadeFnStyleSet);
  // 广播事件
  eventBus.dispatch('update-globale-inline-style');
};

export const setStyle = (name: string, styleSet: StyleSet) => {
  let cascadeStyleSet = localCascadeStyleSetMap[name];
  if (!cascadeStyleSet) {
    cascadeStyleSet = {};
    localCascadeStyleSetMap[name] = cascadeStyleSet;
  }
  let cascadeFnStyleSet = localCascadeFnStyleSetMap[name];
  if (!cascadeFnStyleSet) {
    cascadeFnStyleSet = {};
    localCascadeFnStyleSetMap[name] = cascadeFnStyleSet;
  }
  const localCascadeStyleSet: CascadeStyleSet = {};
  const localCascadeFnStyleSet: CascadeFnStyleSet = {};
  pickCascadeStyleSet(parseStyleSet(styleSet), localCascadeStyleSet, localCascadeFnStyleSet);
  // 合并
  mergeLocalCascadeStyleSet({
    cascadeStyleSet,
    cascadeFnStyleSet,
    localCascadeStyleSet,
    localCascadeFnStyleSet,
  });
  // 广播事件
  eventBus.dispatch('update-local-inline-style', name);
};

const cssVarialbes: Record<string, number | string> = {};

// 设置全局css变量
export const setVariable = (key: string, rawValue: number | string) => {
  if (!key.startsWith('--')) {
    throw new Error(`请使用 css 变量格式，当前变量名为：${key}`);
  }
  let value = rawValue;
  if (typeof rawValue === 'string' && /var\(--/.test(rawValue)) {
    if (/^var\(--[^\)]+\)$/.test(rawValue)) {
      value = getVariable(rawValue) || rawValue;
    } else {
      // 批量替换
      value = rawValue.replace(/var\(--[^\)]+\)/g, (token: string) => {
        return `${getVariable(token) || token}`;
      });
    }
  }
  cssVarialbes[`var(${key})`] = value;
};

export const setVariables = (variables: Record<string, number | string>) => {
  Object.entries(variables).forEach(([key, value]) => {
    setVariable(key, value);
  });
};

export const getVariables = () => cssVarialbes;
export const getVariable = (key: string) => cssVarialbes[`${key}`];
export const getVar = getVariable;

// 合并级联样式集
const mergeCascadeStyleSet = (cascadeStyleSets: {
  cascadeStyleSet: CascadeStyleSet;
  cascadeFnStyleSet: CascadeFnStyleSet;
  currentCascadeStyleSet: CascadeStyleSet;
  currentCascadeFnStyleSet: CascadeFnStyleSet;
}) => {
  const {
    cascadeStyleSet,
    cascadeFnStyleSet,
    currentCascadeStyleSet,
    currentCascadeFnStyleSet,
  } = cascadeStyleSets;
  // 清空自身
  Object.keys(cascadeStyleSet).forEach(key => {
    delete cascadeStyleSet[key];
  });
  Object.keys(cascadeFnStyleSet).forEach(key => {
    delete cascadeFnStyleSet[key];
  });
  // 先处理全局样式
  Object.entries(globalCascadeStyleSet).forEach(([selector, cascadeStyleItem]) => {
    cascadeStyleSet[selector] = [...cascadeStyleItem];
  });
  Object.entries(globalCascadeFnStyleSet).forEach(([selector, cascadeStyleItem]) => {
    cascadeFnStyleSet[selector] = [...cascadeStyleItem];
  });
  // 再处理当前的样式
  Object.entries(currentCascadeStyleSet).forEach(([selector, cascadeStyleItem]) => {
    if (cascadeStyleSet[selector]) {
      cascadeStyleSet[selector].push(...cascadeStyleItem);
    } else {
      cascadeStyleSet[selector] = [...cascadeStyleItem];
    }
  });
  Object.entries(currentCascadeFnStyleSet).forEach(([selector, cascadeStyleItem]) => {
    if (cascadeFnStyleSet[selector]) {
      cascadeFnStyleSet[selector].push(...cascadeStyleItem);
    } else {
      cascadeFnStyleSet[selector] = [...cascadeStyleItem];
    }
  });
  return { cascadeStyleSet, cascadeFnStyleSet };
};

// 合并局部级联样式集
const mergeLocalCascadeStyleSet = (cascadeStyleSets: {
  cascadeStyleSet: CascadeStyleSet;
  cascadeFnStyleSet: CascadeFnStyleSet;
  localCascadeStyleSet?: CascadeStyleSet;
  localCascadeFnStyleSet?: CascadeFnStyleSet;
}) => {
  const {
    cascadeStyleSet,
    cascadeFnStyleSet,
    localCascadeStyleSet,
    localCascadeFnStyleSet,
  } = cascadeStyleSets;
  // 增量合并
  if (localCascadeStyleSet) {
    Object.entries(localCascadeStyleSet).forEach(([selector, cascadeStyleItem]) => {
      if (cascadeStyleSet[selector]) {
        cascadeStyleSet[selector].push(...cascadeStyleItem);
      } else {
        cascadeStyleSet[selector] = [...cascadeStyleItem];
      }
    });
  }
  if (localCascadeFnStyleSet) {
    Object.entries(localCascadeFnStyleSet).forEach(([selector, cascadeStyleItem]) => {
      if (cascadeFnStyleSet[selector]) {
        cascadeFnStyleSet[selector].push(...cascadeStyleItem);
      } else {
        cascadeFnStyleSet[selector] = [...cascadeStyleItem];
      }
    });
  }
};

// 样式生成函数
export function createCss(styleSet: StyleSet) {
  // 没有并入外部级联样式的当前级联样式
  const currentCascadeStyleSet: CascadeStyleSet = {};
  const currentCascadeFnStyleSet: CascadeFnStyleSet = {};
  pickCascadeStyleSet(parseStyleSet(styleSet), currentCascadeStyleSet, currentCascadeFnStyleSet);

  /**
   * cascadeStyleSet & cascadeFnStyleSet 合并了全局级联样式和目标局域级联样式
   * 每次更新前会清空自身，再重新生成一份新的级联样式集
   */
  const cascadeStyleSet: CascadeStyleSet = {};
  const cascadeFnStyleSet: CascadeFnStyleSet = {};

  mergeCascadeStyleSet({
    cascadeStyleSet,
    cascadeFnStyleSet,
    currentCascadeStyleSet,
    currentCascadeFnStyleSet,
  });

  eventBus.on('update-globale-inline-style', () => {
    // 更新样式
    mergeCascadeStyleSet({
      cascadeStyleSet,
      cascadeFnStyleSet,
      currentCascadeStyleSet,
      currentCascadeFnStyleSet,
    });
  });

  // 遍历级联类列表，与当前的父级类列表做匹配
  const travelCascadeStyleList = (
    cascadeStyleList: (CascadeStyleItem & CascadeFnStyleItem)[],
    styleFnArgs: StyleFnArgs,
    callback: (cascadeStyle: PureStyle | FnStyle, weight: number) => void
  ) => {
    const { parentClassList, parentPropsList } = styleFnArgs;
    if (parentClassList.length) {
      cascadeStyleList.forEach(({ parent, style, styleFn, checkSelector, weight }) => {
        const isMatched = checkSelector(styleFnArgs) && parent.every(parentClassName => {
          if (parentClassName === '*') {
            // 通配符直接返回 true
            return true;
          }
          const parentSelectorCheck = complexExecMap[parentClassName];
          return parentPropsList.some((parentProps) => parentSelectorCheck(parentProps.$$extrainfo$$.currentIndex, parentProps.$$extrainfo$$));
        });
        if (isMatched) {
          // 表示找到级联样式了
          if (style) callback(style, weight);
          else if (styleFn) callback(styleFn, weight);
        }
      });
    } else {
      // 根级类型
      cascadeStyleList.forEach(cascadeStyleItem => {
        if(!cascadeStyleItem.parent?.length && cascadeStyleItem.checkSelector(styleFnArgs)) {
          // 选择器检查通过
          const { style, styleFn, weight } = cascadeStyleItem;
          if (style) callback(style, weight);
          else if (styleFn) callback(styleFn, weight);
        }
      });
    }
  };
  
  const EMPTY_STYLE: PureStyle = {};

  // 获取级联样式
  const getCascadeStyle = (key: string, currentIndex: number, styleFnArgs: StyleFnArgs) => {
    const cascadeStyleList = cascadeStyleSet[key];
    const cascadeFnStyleList = cascadeFnStyleSet[key];
    // 没有级联，直接返回 null
    if (!cascadeStyleList?.length && !cascadeFnStyleList?.length) {
      return EMPTY_STYLE;
    }
    const mergeCascadeStyle: PureStyle = {};
    const matchedCascadeStyleList: { cascadeStyle: PureStyle; weight: number }[] = [];
    if (cascadeStyleList?.length) {
      // 有内联样式
      travelCascadeStyleList(cascadeStyleList, styleFnArgs, (cascadeStyle: PureStyle, weight) => {
        // 表示找到级联样式了
        matchedCascadeStyleList.push({ cascadeStyle, weight  });
      });
    }
    if (cascadeFnStyleList?.length) {
      // 有内联类样式
      travelCascadeStyleList(cascadeFnStyleList, styleFnArgs, (cascadeStyleFn: FnStyle, weight) => {
        // 表示找到级联样式了
        matchedCascadeStyleList.push({ cascadeStyle: cascadeStyleFn(currentIndex, styleFnArgs)!, weight  });
      });
    }
    matchedCascadeStyleList.sort((a, b) => a.weight - b.weight).forEach(({ cascadeStyle }) => {
      Object.assign(mergeCascadeStyle, cascadeStyle);
    });
    return matchedCascadeStyleList.length ? mergeCascadeStyle : EMPTY_STYLE;
  };  
  // 合并多样式
  const mergeStyles = (pureStyles: PureStyle[]) => {
    return Object.assign({}, ...pureStyles) as PureStyle;
  }
  // 是否为空
  const isEmptyStyle = (pureStyle: PureStyle) => pureStyle === EMPTY_STYLE;

  // 更新局域级联样式集
  const updateLocalCascadeStyleSet = (name: string) => {
    const localCascadeStyleSet = localCascadeStyleSetMap[name];
    const localCascadeFnStyleSet = localCascadeFnStyleSetMap[name];
    if (Boolean(localCascadeStyleSet) || Boolean(localCascadeFnStyleSet)) {
      mergeLocalCascadeStyleSet({
        cascadeStyleSet,
        cascadeFnStyleSet,
        localCascadeStyleSet,
        localCascadeFnStyleSet,
      });
    }
  };
  
  /**
   * 设置局域名
   * 并且完成局域级联样式的初始化合并到 cascadeStyleSet & cascadeFnStyleSet
   */
  const setLocalName = (name: string) => {
    updateLocalCascadeStyleSet(name);
    eventBus.on('update-local-inline-style', (localName: string) => {
      if (name === localName) {
        updateLocalCascadeStyleSet(name);
      }
    });
  };

  return { getCascadeStyle, mergeStyles, isEmptyStyle, setLocalName };
};
