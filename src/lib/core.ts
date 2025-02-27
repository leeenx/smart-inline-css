/**
 * smart-inline-css 是一个内联样式的管理框架，
 * 它内部实现「选择器」的功能，当前支持的选择器有：
 * 类选择器、元素选择器、无类选择器、before & after 伪元素选择器和通配符
 */

type Props = Record<string, any>;
interface StyleFnArgs {
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

type PureStyle = Record<string, string | number>;
type FnStyle = (index?: number, styleFnArgs?: StyleFnArgs) => PureStyle | undefined;
interface StyleMapStyle {
  [key: string]: string | number | PureStyle | FnStyle | StyleMapStyle
}
type Style = StyleMapStyle | FnStyle;
type PureStyleSet = Record<string, PureStyle>;
type NthSet = Record<string, FnStyle>;
type CascadeStyleItem = {
  parent: string[];
  weight: number;
  style?: PureStyle;
};
type CascadeStyleSet = Record<string, CascadeStyleItem[]>;
type CascadeFnStyleItem = {
  parent: string[];
  weight: number;
  styleFn?: FnStyle;
};
type CascadeFnStyleSet = Record<string, CascadeFnStyleItem[]>;

export type StyleSet = Record<string, Style>;

// 全局样式集合
const globalStyleSet: PureStyleSet = {};

// 全局样式里的 FnStyle
const globalStyleFnSet: Record<string, FnStyle> = {};

// 全局样式里的 cascadeStyle
const globalCascadeStyleSet: CascadeStyleSet= {};

// 全局样式里的 cascadeFnStyle
const globalCascadeFnStyle: CascadeFnStyleSet = {};

// 遍历 childPropsList
const travelChildPropsList = (propsList: Props[], callback: (index: number, styleFnArgs: StyleFnArgs) => boolean) => {
  const childPropsList: Props[] = [];
  // 广度优先
  if (propsList.every(props => {
    if (props?.$$extrainfo$$?.childPropsList?.length) {
      childPropsList.push(...props.$$extrainfo$$.childPropsList);
    }
    return !callback(props.currentIndex, props as StyleFnArgs);
  })) {
    // 没找到，进入子级
    return childPropsList?.length ? travelChildPropsList(childPropsList, callback) : false;
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
        if (selector.indexOf('&:') !== -1) {
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
let uniqueIndex = 0;
const genUniqueKey = (token: string) => {
  let index = uniqueMap[token];
  if (!index) {
    uniqueMap[token] = ++uniqueIndex;
    index = uniqueIndex;
  }
  return `@@COMPLEX_SELECTOR_KEY_${index}@@`
};

type ComplexExec = (index?: number, styleFnArgs?: StyleFnArgs) => boolean;
type ComplexSelectorType = ':not' | ':has' | ':not:has' | ':nth-child' | ':first-child' | ':last-child' | ':only-child' | ':empty' | 'attribute-selector';
const complexExecMap: Record<string, ComplexExec> = {};
const complexSelectorWeight: Record<string, number> = {};
// 复杂选择器转函数
const getExecFromComplexSelector = (complexSelector: string, type?: ComplexSelectorType, getIncreWeight?: (increWeight: number) => void) => {
  let exec = complexExecMap[complexSelector];
  let weight = complexSelectorWeight[complexSelector] || 0;
  if (!exec) {
    if (!type) {
      // 获取基础类，如果没有就是通配符 *
      let className = '*';
      let selector = complexSelector.replace(/^\w+/, (str) => {
        className = str;
        return '';
      });
      if (className !== '*') {
        // 有类名权重变成1
        weight = 1;
      }
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
        selector = selector.replace(/(:has\(:not\([^\)]+\)\))|(:not\(:has\([^\)]+\)\))/g, (matchedItem) => replaceHandler(matchedItem, ':not:has'));
        // 替换 :not
        selector = selector.replace(/:not\([^\)]+\)/g, (matchedItem) => replaceHandler(matchedItem, ':not'));
        // 替换 :has
        selector = selector.replace(/:has\([^\)]+\)/g, (matchedItem) => replaceHandler(matchedItem, ':has'));
      }
      // 生成一个调用链
      const execChain: ComplexExec[] = [checkClassName];
      selector.match(/@@COMPLEX_SELECTOR_KEY_\d+@@/g)?.forEach(matchedItem => {
        execChain.push(complexExecMap[matchedItem])
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
          const expression = complexSelector.replace(/:nth-child\(.+\)/, '$1');
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
        case ':not:has': {
          const expression = complexSelector.replace(/(:not:has\(([^\)]+)\))|(:has:not\(([^\)]+)\))/, '$1');
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
          const [attrName, attrValue] = operator ? selector.split(operator) : [];
          switch (operator) {
            case '=':
              exec = (index: number, styleFnArgs: StyleFnArgs) => styleFnArgs.props[attrName] === attrValue;
              break;
            case '*=':
              exec = (index: number, styleFnArgs: StyleFnArgs) =>  styleFnArgs.props[attrName].includes(attrValue);
              break;
            case '^=':
              exec = (index: number, styleFnArgs: StyleFnArgs) =>  new RegExp(`^${attrName}`).test(styleFnArgs.props[attrName]);
              break;
            case '$=':
              exec = (index: number, styleFnArgs: StyleFnArgs) =>  new RegExp(`${attrName}$`).test(styleFnArgs.props[attrName]);
              break;
            default:
              exec = (index: number, styleFnArgs: StyleFnArgs) => styleFnArgs.props.hasOwnProperty(selector);
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

// 生成复杂选择器的样式
const getComplexSelectorStyle = (complexSelector: string, pureStyle: PureStyle) => {
  
};

getExecFromComplexSelector('parent:has(xxx):has([title="1"])');

// 提取所有的级联样式集
const pickCascadeStyleSet = (
  sourceStyleSet: StyleSet, // 源样式集
  pureStyleSet: PureStyleSet, // 纯样式集
  fnStyleSet: NthSet, // 函数类样式集
  cascadeStyleSet: CascadeStyleSet, // 级联纯样式集
  cascadeFnStyleSet: CascadeFnStyleSet, // 级联函数类样式集
) => {
  const categorize = (style: Style, pureStyle: PureStyle, parent: string[] = []) => {
    const nextParent = [...parent];
    Object.entries(style).forEach(([styleKey, styleValue]) => {
      if (['>', '+', '~'].includes(styleKey)) {
        // 关系符
        console.log('===== 关系符', styleKey);
      }
      if (typeof styleValue === 'function') {
        addCascadeFnStyle(styleKey, {
          parent: nextParent,
          weight: nextParent.length, // 权重就是父级的长度
          styleFn: styleValue as FnStyle,
        }, cascadeFnStyleSet);
      } else if (typeof styleValue === 'object') {
        // 级联
        const curPureStyle: PureStyle = {};
        nextParent.push(styleKey);
        categorize(styleValue as Style, curPureStyle, nextParent);
        nextParent.pop();
        if (Object.keys(curPureStyle).length) { // 非空样式
          addCascadeStyle(styleKey, {
            parent: nextParent,
            weight: nextParent.length, // 权重就是父级的长度
            style: curPureStyle,
          }, cascadeStyleSet);
        }
      } else {
        pureStyle[styleKey] = styleValue as string;
      }
    });
  };

  Object.entries(sourceStyleSet).forEach(([key, style]) => {
    if(typeof style === 'function') {
      fnStyleSet[key] = style;
    } else {
      pureStyleSet[key] = (() => {
        const pureStyle: PureStyle = {};
        categorize(style, pureStyle, [key]);
        return pureStyle;
      })();
    }
  });
};

// 全局样式
export const setGlobalStyle = (styleSet: StyleSet) => {
  const pureStyleSet: PureStyleSet = {};
  // 提取出纯样式与nth函数
  pickCascadeStyleSet(styleSet, globalStyleSet, globalStyleFnSet, globalCascadeStyleSet, globalCascadeFnStyle);
  Object.assign(globalStyleSet, pureStyleSet);
};

const cssVarialbes: Record<string, number | string> = {};

// 设置全局css变量
export const setVariable = (key: string, value: number | string) => {
  cssVarialbes[key] = value;
};

export const setVariables = (variables: Record<string, number | string>) => {
  Object.entries(variables).forEach(([key, value]) => {
    setVariable(key, value);
  });
};

export const getVariables = () => cssVarialbes;
export const getVariable = (key: string) => cssVarialbes[key];
export const getVar = getVariable;

// 样式生成函数
export function createCss(styleSet: StyleSet) {
  const pureStyleSet: PureStyleSet = {};
  const fnStyleSet: Record<string, FnStyle> = {};
  const cascadeStyleSet: CascadeStyleSet = {};
  const cascadeFnStyleSet: CascadeFnStyleSet = {};
  pickCascadeStyleSet(parseStyleSet(styleSet), pureStyleSet, fnStyleSet, cascadeStyleSet, cascadeFnStyleSet);
  // 将 globalStyleSet 与 pureStyleSet 合并生成新的对象
  const mergeStyleSet: PureStyleSet = {};
  Object.entries(globalStyleSet).forEach(([key, value]) => {
    mergeStyleSet[key] = Object.assign({}, value);
  });
  Object.entries(pureStyleSet).forEach(([key, value]) => {
    if (mergeStyleSet[key]) Object.assign(mergeStyleSet[key], value);
    else mergeStyleSet[key] = Object.assign({}, value);
  });
  // 将 globalStyleFnSet 与 fnStyleSet 合并
  const mergeFnStyleSet: Record<string, FnStyle> = {};
  Object.entries(globalStyleFnSet).forEach(([key, value]) => {
    mergeFnStyleSet[key] = value;
  });
  Object.entries(fnStyleSet).forEach(([key, value]) => {
    if (globalStyleFnSet[key]) {
      mergeFnStyleSet[key] = (index: number) => Object.assign(globalStyleFnSet[key](index) || {}, value(index));
    } else {
      mergeFnStyleSet[key] = value;
    }
  });

  // 遍历级联类列表，与当前的父级类列表做匹配
  const travelCascadeStyleList = (
    cascadeStyleList: (CascadeStyleItem & CascadeFnStyleItem)[],
    parentClassList: string[][],
    callback: (cascadeStyle: PureStyle | FnStyle) => void
  ) => {
    cascadeStyleList.forEach(({ parent, style, styleFn }) => {
      const isMatched = parent.every(item => {
        if (item === '*') {
          // 通配符直接返回 true
          return true;
        }
        return parentClassList.some(classList => {
          const len = classList.length;
          for (let i = 0; i < len; ++i) {
            if (classList[i] === item) {
              return true;
            }
          }
          return false;
        });
      });
      if (isMatched) {
        // 表示找到级联样式了
        if (style) callback(style);
        else if (styleFn) callback(styleFn);
      }
    });
  };

  const css = (...args) => {
    if (!args.length) {
      const getCascadeStyle = (key: string, currentIndex: number, styleFnArgs: StyleFnArgs) => {
        const parentClassList: string[][] = styleFnArgs.parentClassList;
        const cascadeStyleList = cascadeStyleSet[key];
        const cascadeFnStyleList = cascadeFnStyleSet[key];
        // 没有级联，直接返回 null
        if (!cascadeStyleList?.length && !cascadeFnStyleList?.length) return {};
        const mergeCascadeStyle: PureStyle = {};
        if (cascadeStyleList?.length) {
          // 有内联样式
          travelCascadeStyleList(cascadeStyleList, parentClassList, (cascadeStyle) => {
            // 表示找到级联样式了
            Object.assign(mergeCascadeStyle, cascadeStyle as PureStyle);
          });
        }
        if (cascadeFnStyleList?.length) {
          // 有内联类样式
          travelCascadeStyleList(cascadeFnStyleList, parentClassList, (cascadeStyleFn) => {
            // 表示找到级联样式了
            Object.assign(mergeCascadeStyle, (cascadeStyleFn as FnStyle)(currentIndex, styleFnArgs));
          });
        }
        return mergeCascadeStyle;
      };
      return {
        $$getCascadeStyle$$: getCascadeStyle,
        mergeStyleSet,
        mergeFnStyleSet,
      };
    };
    const keys = args as string[]
    if (keys.length > 1) {
      const styles: PureStyle[] = keys.map(item => css(item));
      return Object.assign({}, ...styles);
    }
    const key = keys[0];
    // 表示入参是一段样式，直接返回
    if (!Array.isArray(key) && typeof key === 'object') {
      return key;
    }
    const style = (() => {
      if (Array.isArray(key)) {
        // 数组，表示当前是一个函数类调用
        const [fn, ...args] = key;
        return mergeFnStyleSet[fn]?.(...args);
      }
      return mergeFnStyleSet[key]?.() || mergeStyleSet[key];
    })();
    return style;
  }
  return css;
};
