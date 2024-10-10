import React, { memo, Fragment } from "react";
import type { JSXElementConstructor } from "react";

type Css = (...args) => any;

// createElement 劫持
const ReactCreateElement = React.createElement;
// @ts-ignore
React.createElement = ((type, props, ...children) => {
  if (typeof type !== 'string' && type !== React.Fragment) {
    if (!props) {
      return ReactCreateElement(type, {
        $$nthchildinfo$$: {
          parentClassList: []
        }
      }, ...children);
    } else if (!props.$$nthchildinfo$$) {
      Object.assign(props, {
        $$nthchildinfo$$: {
          parentClassList: []
        }
      });
    }
  }
  return ReactCreateElement(type, props, ...children);
}) as typeof ReactCreateElement;

/**
 * 需要对全局组件做封装
 * 因为有 ::before 与 ::after 两个伪元素
 * 通过对全局组件进行封装后，以下组件将会自动生成【::before】与【::after】:
 * view、text、button、label、cover-view、movable-view
 */
const defaultContainerComponentMapping: Record<string, string> = {
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

export function componentBindCss<T>(css: Css, sourceGlobalComponents: T, containerComponentMapping = defaultContainerComponentMapping) {
  const textComponentName = containerComponentMapping.Text;
  const Text = sourceGlobalComponents[textComponentName] as JSXElementConstructor<any>;
  const containerComponentNames = Object.values(containerComponentMapping);
  const globalComponents = {} as T & { Fragment: typeof Fragment };

  // 返回所有的样式（包括函数）
  const styleSet = css();

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
      $$nthchildinfo$$,
      ...others
    } = props;
    const childList = (() => {
      if (children) {
        return Array.isArray(children) ? children : [children];
      }
      return [];
    })();
    const cssNames = className?.split(/\s+/);
    const nthChildInfo = $$nthchildinfo$$;
    const parentClassList: string[][] = [...nthChildInfo.parentClassList];
    const { isFirst, isLast, isOdd, isEven, currentIndex, parentMemoId } = nthChildInfo;
    // 传递给样式函数的参数
    const styleFnArgs = { ...nthChildInfo, parentClassList, sourceComponentName, props };
    let memoId: string = `${className || ''}#1`;
    const style = (() => {
      if (!className) return rawStyle;
      let resultStyle: any = {};
      if (cssNames.length) {
        if (nthChildInfo) {
          // 生成缓存 id
          const currentNodeMemoId = `${className}#${currentIndex}`;
          memoId = parentMemoId ? `${parentMemoId}|${currentNodeMemoId}` : currentNodeMemoId;
          resultStyle = getMemoCascadeStyle(memoId, () => {
            // 表示在迭代循环中，需要按需添加伪类
            const cssNameList: any[] = [];
            cssNames.forEach((cssName) => {
              const isEmpty = childList.length === 0;
              const isOnlyChild = childList.length === 1;
              Object.assign(styleFnArgs, { isEmpty, isOnlyChild });
              cssNameList.push(typeof styleSet[cssName] === 'function' ? [cssName, currentIndex, styleFnArgs] : cssName);
              cssNameList.push([`${cssName}:nth-child`, currentIndex, styleFnArgs]);
              cssNameList.push(`${cssName}:nth-child(${currentIndex})`);
              if (isOdd) {
                cssNameList.push(`${cssName}:nth-child(odd)`);
              }
              if (isEven) {
                cssNameList.push(`${cssName}:nth-child(even)`);
              }
              if (isFirst) {
                cssNameList.push(`${cssName}:first-child`);
              }
              if (isLast) {
                cssNameList.push(`${cssName}:last-child`);
              }
              if (isEmpty) {
                cssNameList.push(`${cssName}:empty`);
              }
              if (isOnlyChild) {
                cssNameList.push(`${cssName}:only-child`);
              }
            });
            const currentClassList = cssNameList.filter(item => !Array.isArray(item));
            let cascadeStyleList: any[] = [];
            currentClassList.forEach(className => {
              const cascadeStyle = styleSet.$$getCascadeStyle$$(className, parentClassList, currentIndex, styleFnArgs);
              if (cascadeStyle) {
                cascadeStyleList.push(cascadeStyle);
              }
            });
            parentClassList.push(currentClassList);
            return css(...cssNameList, ...cascadeStyleList);
          });
        } else {
          // 根节点会进这个分支
          parentClassList.push(cssNames);
          resultStyle = getMemoCascadeStyle(memoId, () => {
            const cssNameList = cssNames.map(cssName => typeof styleSet[cssName] === 'function' ? [cssName, 1, styleFnArgs] : cssName);
            return css(...cssNameList);
          });
        }
      }
      return  resultStyle ? Object.assign(resultStyle, rawStyle) : rawStyle;
    })();
    const beforeClassList: string[] = [];
    const afterClassList: string[] = [];
    cssNames?.forEach(cssName => {
      const beforeClass = `${cssName}::before`;
      const afterClass = `${cssName}::after`;
      if (styleSet.hasOwnProperty(beforeClass)) {
        // 有 before
        beforeClassList.push(beforeClass);
      }
      if (styleSet.hasOwnProperty(afterClass)) {
        // 有 after
        afterClassList.push(afterClass);
      }
    });
    const renderBefore = () => {
      if (!beforeClassList.length) return null;
      const beforeStyle = css(...beforeClassList);
      if (!beforeStyle.hasOwnProperty('content')) return null;
      const content = beforeStyle.content;
      return <Text style={beforeStyle} data-pseudo="::before">{content}</Text>;
    };
    const renderAfter = () => {
      if (!afterClassList.length) return null;
      const afterStyle = css(...afterClassList);
      if (!afterStyle.hasOwnProperty('content')) return null;
      const content = afterStyle.content;
      return <Text style={afterStyle} data-pseudo="::after">{content}</Text>;
    };
    if (childList.length) {
      const currentArrayLen = childList.length;
      let currentIndex = 1;
      childList.forEach(child => {
        if (child.props) {
          const isEven = currentIndex % 2 === 0;
          const isOdd = !isEven;
          const isFirst = currentIndex === 1;
          const isLast = currentIndex === currentArrayLen;
          if (child.props.$$nthchildinfo$$) {
            Object.assign(child.props.$$nthchildinfo$$, {
              currentArrayLen,
              currentIndex,
              isOdd,
              isEven,
              isFirst,
              isLast,
              parentClassList,
              parentMemoId: memoId,
            });
          }
          currentIndex += 1;
        }
      })
    }
    // 微信小程序中，SourceComponent 是字符串，所以需要用 createElement 来实现
    if (sourceComponentName === 'Fragment') {
      return React.createElement(SourceComponent, others, [renderBefore(), children, renderAfter()]);
    }
    return React.createElement(SourceComponent, {
      className,
      style,
      ...others
    }, [renderBefore(), children, renderAfter()]);
  });

  // 生成没有伪类的组件
  const createAtomComponent = (SourceComponent: JSXElementConstructor<any>, sourceComponentName: string) => memo((props: any) => {
    const {
      $$nthchildinfo$$,
      className,
      style: rawStyle = {},
      ...others
    } = props;
    const cssNames = className?.split(/\s+/);
    // const style = className ? css(...cssNames, rawStyle) : rawStyle;
    const nthChildInfo = $$nthchildinfo$$;
    const parentClassList: string[][] = [...nthChildInfo.parentClassList];
    // 传递给样式函数的参数
    const styleFnArgs = { ...nthChildInfo, parentClassList, sourceComponentName, props };
    const style = (() => {
      if (!className) return rawStyle;
      // 生成缓存 id
      const { currentIndex = 1, parentMemoId } = nthChildInfo;
      const currentNodeMemoId = `${className || ''}#${currentIndex}`;
      const memoId = parentMemoId ? `${parentMemoId}|${currentNodeMemoId}` : currentNodeMemoId;
      const resultStyle: any = getMemoCascadeStyle(memoId, () => {
        const currentClassList = cssNames.filter(item => !Array.isArray(item));
        let cascadeStyleList: any[] = [];
        currentClassList.forEach(className => {
          const cascadeStyle = styleSet.$$getCascadeStyle$$(className, parentClassList, currentIndex, styleFnArgs);
          if (cascadeStyle) {
            cascadeStyleList.push(cascadeStyle);
          }
        });
        parentClassList.push(currentClassList);
        const cssNameList = cssNames.map(cssName => typeof styleSet[cssName] === 'function' ? [cssName, 1, styleFnArgs] : cssName);
        return css(...cssNameList, ...cascadeStyleList);
      });
      return Object.assign(resultStyle, rawStyle);
    })();
    // 微信小程序中，SourceComponent 是字符串，所以需要用 createElement 来实现
    return React.createElement(SourceComponent, {
      className,
      style,
      ...others
    });
  });

  // fragment 容器
  globalComponents['Fragment'] = createContainerComponent(Fragment, 'Fragment');

  Object.keys(sourceGlobalComponents as Object).forEach((componentName) => {
    const key: string = componentName;
    const SourceComponent = sourceGlobalComponents[key] as JSXElementConstructor<any>;
    if (containerComponentNames.includes(key)) {
      globalComponents[key] = createContainerComponent(SourceComponent, key);
    } else {
      globalComponents[key] = createAtomComponent(SourceComponent, key);
    }
  });

  return globalComponents;
};
