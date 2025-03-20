import React, {
  memo,
  Fragment,
  useMemo,
  useEffect,
  useState,
  version,
  type JSXElementConstructor,
  type PropsWithChildren,
} from "react";
import jsxRuntime from 'react/jsx-runtime';
import { eventBus } from './event-bus';
import type { PureStyle, StyleFnArgs } from './core';

type CreateCssReturn = {
  getCascadeStyle: (key: string, currentIndex: number, styleFnArgs: StyleFnArgs) => PureStyle;
  mergeStyles: (pureStyles: PureStyle[]) => PureStyle;
  isEmptyStyle: (pureStyle: PureStyle) => boolean;
  setLocalName: (name: string) => void;
}


// createElement 劫持
const ReactCreateElement = React.createElement;
const createJSX = parseFloat(version) < 19 ? React.createElement : jsxRuntime.jsx;

const createDefaultExtraInfo = () => ({
  parentClassList: [],
  parentPropsList: [],
  siblingPropsList: [],
  childPropsList: [],
});

const hijactJSX = ((type, props, ...children) => {
  if (typeof type !== 'string' && type !== React.Fragment) {
    if (!props) {
      // @ts-expect-error
      return createJSX(type, { $$extrainfo$$: createDefaultExtraInfo() }, ...children);
      // @ts-expect-error 忽略 props 类型
    } else if (!props.$$extrainfo$$) {
      Object.assign(props, { $$extrainfo$$: createDefaultExtraInfo() });
    }
  }
  // @ts-expect-error
  return createJSX(type, props, ...children);
}) as typeof createJSX;

if (parseFloat(version) < 19) { // 19 之前走 createElement
  // @ts-ignore
  React.createElement = hijactJSX;
} else { // 19 走 jsx
  // @ts-ignore
  jsxRuntime.jsx = hijactJSX;
}


/**
 * 需要对全局组件做封装
 * 因为有 ::before 与 ::after 两个伪元素
 * 通过对全局组件进行封装后，以下组件将会自动生成【::before】与【::after】:
 * view、text、button、label、cover-view、movable-view
 */
const taroContainerComponentMapping: Record<string, string> = {
  Fragment: 'Fragment',
  View: 'View',
  Text: 'Text',
  Button: 'Button',
  Label: 'Label',
  CoverView: 'CoverView',
  MovableView: 'MovableView',
  MovableArea: 'MovableArea',
  Swiper: 'Swiper',
  SwiperItem: 'SwiperItem',
  MatchMedia: 'MatchMedia',
};

// 用来初始化样式的专用组件
const InitStyleComponent = memo((props: { initStyle: () => void }) => {
  props.initStyle();
  return null;
});

// 组件名称
const styleWrapKeyMap: Record<string, string> = {};

// 内联样式容器
type StyleWrapProps = PropsWithChildren<{ name: string, setLocalName?: (name: string) => void; }>;
const StyleWrap = memo((props: StyleWrapProps) => {
  const { name, setLocalName } = props;
  const [index, update] = useState(0);
  useMemo(() => {
    if (name) {
      if (styleWrapKeyMap[name]) {
        // 名字冲突
        console.error('withInlineStyleWrap name 冲突，请检查！');
      }
      // 设置局部级联样式作用域名
      setLocalName?.(name);
    }
  }, []);
  useEffect(() => {
    eventBus.on('update-globale-inline-style', () => {
      updateNodeMemoIdByName(name);
      update(index => index + 1);
    });
    eventBus.on('update-local-inline-style', (localName: string) => {
      if (localName === name) {
        updateNodeMemoIdByName(name);
        update(index => index + 1);
      }
    });
  }, []);
  return <Fragment key={index}>{ props.children }</Fragment>;
});

const nodeMemoIdMap: Record<string, string> = {};

// 缓存ID的索引
let memoIndex = 0;
// 按 name 返回一个缓存id 
const getNodeMemoIdByName = (name: string) => {
  let memoId = nodeMemoIdMap[name];
  if (!memoId) {
    memoId = `${name}#${++memoIndex}`;
    nodeMemoIdMap[name] = memoId;
  }
  return memoId;
};

// 更新 memoId
const updateNodeMemoIdByName = (name: string) => {
  nodeMemoIdMap[name] = `${name}#${++memoIndex}`;
};

export function componentBindCss<T>({ getCascadeStyle, mergeStyles, isEmptyStyle, setLocalName }: CreateCssReturn, sourceGlobalComponents: T, containerComponentMapping = taroContainerComponentMapping) {
  const textComponentName = containerComponentMapping.Text;
  const Text = (sourceGlobalComponents as Record<string, JSXElementConstructor<any>>)[textComponentName];
  const containerComponentNames = Object.values(containerComponentMapping);

  const globalComponents = {} as T & { Fragment: typeof Fragment; StyleWrap: typeof StyleWrap; };

  // 缓存样式
  const memoCascadeStyleSet: Record<string, any> = {};

  const getMemoCascadeStyle = (memoId: string, createMemoStyle: () => any) => {
    let memoStyle: any = memoCascadeStyleSet[memoId];
    if (!memoStyle) {
      memoStyle = memoCascadeStyleSet[memoId] = createMemoStyle();
    }
    return memoStyle;
  };

  // 生成有伪类的组件
  const createContainerComponent = (SourceComponent: JSXElementConstructor<any>, sourceComponentName: string) => memo((props: any) => {
    const {
      className,
      children,
      style: rawStyle = {},
      $$extrainfo$$,
      ...others
    } = props;
    const childList = (() => {
      if (children) {
        if (Array.isArray(children)) {
          return children;
        }
        // 非数组，转成数组
        return [children];
      }
      return [];
    })();
    const cssNames = className?.split(/\s+/) || [];
    const extraInfo = $$extrainfo$$;
    const { currentIndex = 1, parentMemoId, childPropsList, localName } = extraInfo;
    // 传递给样式函数的参数
    const styleFnArgs = {
      ...extraInfo,
      $$extrainfo$$,
      sourceComponentName,
      props,
    };
    // 生成缓存 id
    const currentNodeMemoId = (sourceComponentName !== 'StyleWrap' ? `<${sourceComponentName}>${className}#${currentIndex}` : '');
    const currentClassList: string[] = ['*', sourceComponentName, ...cssNames];
    const parentClassList: string[][] = [...extraInfo.parentClassList, currentClassList];
    let memoId: string = parentMemoId ? `${parentMemoId}|${currentNodeMemoId}` : currentNodeMemoId;
    if (localName) {
      memoId = `${getNodeMemoIdByName(localName)}|${memoId}`;
    }
    const beforeStyles: PureStyle[] = [];
    const afterStyles: PureStyle[] = [];
    cssNames?.forEach((cssName: string) => {
      const beforeCss = getCascadeStyle(`${cssName}::before`, currentIndex, styleFnArgs);
      const afterCss = getCascadeStyle(`${cssName}::after`, currentIndex, styleFnArgs);
      if (!isEmptyStyle(beforeCss)) {
        // 有 before
        beforeStyles.push(beforeCss);
      }
      if (!isEmptyStyle(afterCss)) {
        // 有 after
        afterStyles.push(afterCss);
      }
    });
    const renderBefore = () => {
      if (!beforeStyles.length) return null;
      const beforeStyle = mergeStyles(beforeStyles);
      if (!beforeStyle.hasOwnProperty('content')) return null;
      const content = beforeStyle.content;
      return <Text style={beforeStyle} data-pseudo="::before" key="pseudo-before">{content}</Text>;
    };
    const renderAfter = () => {
      if (!afterStyles.length) return null;
      const afterStyle = mergeStyles(afterStyles);
      if (!afterStyle.hasOwnProperty('content')) return null;
      const content = afterStyle.content;
      return <Text style={afterStyle} data-pseudo="::after" key="pseudo-after">{content}</Text>;
    };

    if (childList.length) {
      let currentArrayLen = childList.length;
      let currentIndex = 1;
      const parentPropsList: any[] = [...extraInfo.parentPropsList, props];
      const siblingPropsList: any[] = [];
      const siblingClassList: string[][] = [];
      const childrenIterate = (child: any) => {
        if (child.props) {
          // 兄弟节点的 props 列表
          siblingPropsList.push(child.props);
          const classList: string[] = ['*'];
          const childComponentName = child.type?.componentName;
          if (childComponentName) {
            classList.push(childComponentName);
          }
          classList.push(...(child.props?.className?.split(/\s+/) || []));
          siblingClassList.push(classList);
          const isEven = currentIndex % 2 === 0;
          const isOdd = !isEven;
          const isFirst = currentIndex === 1;
          const isLast = currentIndex === currentArrayLen;
          childPropsList.push(child.props);
          if (child.props.$$extrainfo$$) {
            Object.assign(child.props.$$extrainfo$$, {
              currentArrayLen,
              currentIndex,
              isOdd,
              isEven,
              isFirst,
              isLast,
              parentClassList,
              parentPropsList,
              siblingClassList,
              siblingPropsList,
              parentMemoId: memoId,
              localName: props.name,
              props: child.props,
            });
          }
          currentIndex += 1;
        } else if (Array.isArray(child)) {
          child.forEach(childrenIterate);
        }
      };
      childList.forEach(childrenIterate);
    }
    // 微信小程序中，SourceComponent 是字符串，所以需要用 createElement 来实现
    if (sourceComponentName === 'Fragment') {
      return React.createElement(SourceComponent, others, [renderBefore(), children, renderAfter()]);
    }
    const isEmpty = childList.length === 0;
    const isOnlyChild = childList.length === 1;
    Object.assign(styleFnArgs, { currentClassList, isEmpty, isOnlyChild });
    Object.assign($$extrainfo$$, { currentClassList, isEmpty, isOnlyChild });
    // 在生成 child 之后生成样式，这样可以获取到完整的 parentPropsList、sublingPropsList 和 childPropsList
    const style: PureStyle = {};
    const elementOptions = { className, style, ...others };
    if (sourceComponentName === 'StyleWrap') {
      Object.assign(elementOptions, { setLocalName });
    }
    const initStyle = () => {
      // 在渲染子元素后再生成样式
      Object.assign(style, (() => {
        if (!className) return rawStyle;
        let resultStyle: PureStyle = {};
        if (cssNames.length) {
          resultStyle = getMemoCascadeStyle(memoId, () => {
            // 表示在迭代循环中，按需添加伪类
            const cascadeStyleList: PureStyle[] = currentClassList
              .map(className => getCascadeStyle(className, currentIndex, styleFnArgs))
              .filter(cascadeStyle => !isEmptyStyle(cascadeStyle));
            return mergeStyles(cascadeStyleList);
          });
        }
        return resultStyle ? Object.assign(resultStyle, rawStyle) : rawStyle;
      })());
    };
    const content = [
      renderBefore(),
      children,
      renderAfter(),
      <InitStyleComponent key="initStyle" initStyle={initStyle} />
    ].filter(item => Boolean(item));
    const element = ReactCreateElement(SourceComponent, elementOptions, content);
    return element;
  });

  // 生成没有伪类的组件
  const createAtomComponent = (SourceComponent: JSXElementConstructor<any>, sourceComponentName: string) => memo((props: any) => {
    const {
      $$extrainfo$$,
      className,
      style: rawStyle = {},
      ...others
    } = props;
    const cssNames = className?.split(/\s+/);
    cssNames.unshift('*', sourceComponentName);
    const extraInfo = $$extrainfo$$;
    const parentClassList: string[][] = [...extraInfo.parentClassList];

    // 传递给样式函数的参数
    const styleFnArgs = {
      ...extraInfo,
      parentClassList,
      sourceComponentName,
      props,
    };
    const style = (() => {
      if (!className) return rawStyle;
      // 生成缓存 id
      const { currentIndex = 1, parentMemoId } = extraInfo;
      const currentNodeMemoId = `<${sourceComponentName}>${className || ''}#${currentIndex}`;
      const memoId = parentMemoId ? `${parentMemoId}|${currentNodeMemoId}` : currentNodeMemoId;
      const resultStyle: PureStyle = getMemoCascadeStyle(memoId, () => {
        const cascadeStyleList: PureStyle[] = cssNames
          .map((cssName: string) => getCascadeStyle(cssName, currentIndex, styleFnArgs))
          .filter((cascadeStyle: PureStyle) => !isEmptyStyle(cascadeStyle));
        parentClassList.push(cssNames);
        Object.assign(styleFnArgs, { currentClassList: cssNames });
        Object.assign($$extrainfo$$, { currentClassList: cssNames });
        return mergeStyles(cascadeStyleList);
      });
      return Object.assign(resultStyle, rawStyle);
    })();
    // 微信小程序中，SourceComponent 是字符串，所以需要用 createElement 来实现
    return ReactCreateElement(SourceComponent, {
      className,
      style,
      ...others
    });
  });

  // fragment 容器
  globalComponents['Fragment'] = createContainerComponent(Fragment, 'Fragment');

  // StyleWrap 容器
  globalComponents['StyleWrap'] = createContainerComponent(StyleWrap, 'StyleWrap');

  Object.keys(sourceGlobalComponents as Object).forEach((componentName) => {
    const key: string = componentName;
    const SourceComponent = (sourceGlobalComponents as Record<string, JSXElementConstructor<any>>)[key];
    if (containerComponentNames.includes(key)) {
      globalComponents[key] = createContainerComponent(SourceComponent, key);
    } else {
      globalComponents[key] = createAtomComponent(SourceComponent, key);
    }
    Object.assign(globalComponents[key], { componentName })
  });

  return globalComponents;
};

