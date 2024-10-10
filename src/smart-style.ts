type PureStyle = Record<string, string | number>;
type FnStyle = (...args) => PureStyle | undefined;
interface StyleValue<T> {
  [key: string]: T;
}
type Style = Record<string, string | number | PureStyle | FnStyle> | StyleValue<Style> | FnStyle;
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

// 按权重添加
const addStyleItemByWeight = (
  item: CascadeStyleItem,
  cascadeFnStyleList: CascadeFnStyleItem[] | CascadeStyleItem[]
) => {
  const lastIndex = cascadeFnStyleList.length - 1;
  for(let i = lastIndex; i >=  0; --i) {
    const cascadeFnStyleItem = cascadeFnStyleList[i];
    if (item.weight >= cascadeFnStyleItem.weight) {
      // 插在当前位置后面
      cascadeFnStyleList.splice(i + 1, 0, item);
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

const pickStyleSet = (
  sourceStyle: StyleSet, // 源样式集
  pureStyleSet: PureStyleSet, // 纯样式集
  fnStyleSet: NthSet, // 函数类样式集
  cascadeStyleSet: CascadeStyleSet, // 级联纯样式集
  cascadeFnStyleSet: CascadeFnStyleSet, // 级联函数类样式集
) => {
  
  const categorize = (key: string, style: Style, pureStyle: PureStyle, parent: string[] = []) => {
    const nextParent = [...parent];
    const lastParentIndex = parent.length - 1;
    Object.entries(style).forEach(([styleKey, styleValue]) => {
      if (typeof styleValue === 'function') {
        /**
         * 表示函数类
         * 这个条件作为第一个条件是因为函数类优先；
         * 针对伪类或伪元素是一个函数表达时有用。
         */
        if (styleKey.startsWith('&:')) {
          // 表示 :nth-child 伪类
          const nthChildKey = `${key}${styleKey.replace('&', '')}`;
          if (parent.length <= 1) {
            fnStyleSet[nthChildKey] = styleValue as FnStyle;
          } else  {
            // 级联
            nextParent.pop();
            addCascadeFnStyle(nthChildKey, {
              parent: nextParent,
              weight: nextParent.length, // 权重就是父级的长度
              styleFn: styleValue as FnStyle
            }, cascadeFnStyleSet);
          }
        } else {
          // 级联
          addCascadeFnStyle(styleKey, {
            parent: nextParent,
            weight: nextParent.length, // 权重就是父级的长度
            styleFn: styleValue as FnStyle,
          }, cascadeFnStyleSet);
        }
      } else if (styleKey.startsWith('&')) {
        // 支持父级选择器后，会存在多级嵌套
        const cssKey = `${key}${styleKey.replace('&', '')}`;
        const curPureStyle: PureStyle = {};
        nextParent[lastParentIndex] = cssKey;
        categorize(cssKey, styleValue as Style, curPureStyle, nextParent);
        if (parent.length === 1) {
          pureStyleSet[cssKey] = curPureStyle;
        } else {
          nextParent.pop();
          addCascadeStyle(cssKey, {
            parent: nextParent,
            weight: nextParent.length, // 权重就是父级的长度
            style: curPureStyle,
          }, cascadeStyleSet);
        }
      } else if (typeof styleValue === 'object') {
        // 级联
        const curPureStyle: PureStyle = {};
        nextParent.push(styleKey);
        categorize(styleKey, styleValue as Style, curPureStyle, nextParent);
        nextParent.pop();
        addCascadeStyle(styleKey, {
          parent: nextParent,
          weight: nextParent.length, // 权重就是父级的长度
          style: curPureStyle,
        }, cascadeStyleSet);
      } else {
        pureStyle[styleKey] = styleValue as string;
      }
    });
  };
  Object.entries(sourceStyle).forEach(([key, style]) => {
    if(typeof style === 'function') {
      fnStyleSet[key] = style;
    } else {
      pureStyleSet[key] = (() => {
        const pureStyle: PureStyle = {};
        categorize(key, style, pureStyle, [key]);
        return pureStyle;
      })();
    }
  });
};

// 全局样式
export const setGlobalStyle = (styleSet: StyleSet) => {
  const pureStyleSet: PureStyleSet = {};
  // 提取出纯样式与nth函数
  pickStyleSet(styleSet, globalStyleSet, globalStyleFnSet, globalCascadeStyleSet, globalCascadeFnStyle);
  Object.assign(globalStyleSet, pureStyleSet);
};

// 样式生成函数
export function createCss(styleSet: StyleSet) {
  const pureStyleSet: PureStyleSet = {};
  const fnStyleSet: Record<string, FnStyle> = {};
  const cascadeStyleSet: CascadeStyleSet = {};
  const cascadeFnStyleSet: CascadeFnStyleSet = {};
  pickStyleSet(styleSet, pureStyleSet, fnStyleSet, cascadeStyleSet, cascadeFnStyleSet);
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
      let startIndex = 0;
      const isMatched = parent.every(item => parentClassList.some(classList => {
        const len = classList.length;
        for (let i = startIndex; i < len; ++i) {
          if (classList[i].includes(item)) {
            startIndex = i + 1; // 更新下一次的起始索引
            return true;
          }
        }
        return false;
      }));
      if (isMatched) {
        // 表示找到级联样式了
        if (style) callback(style);
        else if (styleFn) callback(styleFn);
      }
    });
  };

  const css = (...args) => {
    if (!args.length) {
      return Object.assign({
        $$getCascadeStyle$$(key: string, parentClassList: string[][], currentIndex: number, styleFnArgs?: any) {
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
        },
      }, mergeStyleSet, mergeFnStyleSet);
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
