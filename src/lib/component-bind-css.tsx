import React, { memo, Fragment, type JSXElementConstructor } from "react";

type Css = (...args) => any;

// createElement 劫持
const ReactCreateElement = React.createElement;
// @ts-ignore
React.createElement = ((type, props, ...children) => {
  if (typeof type !== 'string' && type !== React.Fragment) {
    if (!props) {
      return ReactCreateElement(type, {
        $$extrainfo$$: {
          parentClassList: [],
          parentPropsList: [],
          siblingPropsList: [],
          childPropsList: [],
        }
      }, ...children);
    } else if (!props.$$extrainfo$$) {
      Object.assign(props, {
        $$extrainfo$$: {
          parentClassList: [],
          parentPropsList: [],
          siblingPropsList: [],
          childPropsList: [],
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

export function componentBindCss<T>(css: Css, sourceGlobalComponents: T, containerComponentMapping = taroContainerComponentMapping) {
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
      $$extrainfo$$,
      ...others
    } = props;
    const childList = (() => {
      if (children) {
        return Array.isArray(children) ? children : [children];
      }
      return [];
    })();
    const cssNames = className?.split(/\s+/);
    const extraInfo = $$extrainfo$$;
    const parentClassList: string[][] = [...extraInfo.parentClassList];
    const { isFirst, isLast, isOdd, isEven, currentIndex = 1, parentMemoId, childPropsList } = extraInfo;
    // 传递给样式函数的参数
    const styleFnArgs = {
      ...extraInfo,
      parentClassList,
      sourceComponentName,
      props,
    };
    // 生成缓存 id
    const currentNodeMemoId = `<${sourceComponentName}>${className}#${currentIndex}`;
    const memoId: string = parentMemoId ? `${parentMemoId}|${currentNodeMemoId}` : currentNodeMemoId;
    
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
      const parentPropsList: any[] = [...extraInfo.parentPropsList, props];
      const siblingPropsList: any[] = [];
      const siblingClassList: string[][] = [];
      childList.forEach(child => {
        if (child.props) {
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
            });
          }
          currentIndex += 1;
        }
        // 兄弟节点的 props 列表
        siblingPropsList.push(child.props);
        const classList: string[] = [];
        classList.push('*');
        const childComponentName = child.type?.componentName;
        if (childComponentName) {
          classList.push(childComponentName);
        }
        classList.push(...(child.props?.className?.split(/\s+/) || []));
        siblingClassList.push(classList);
      });
    }
    // 微信小程序中，SourceComponent 是字符串，所以需要用 createElement 来实现
    if (sourceComponentName === 'Fragment') {
      return React.createElement(SourceComponent, others, [renderBefore(), children, renderAfter()]);
    }
    // 在生成 child 之后生成样式，这样可以获取到完整的 parentPropsList、sublingPropsList 和 childPropsList
    const style = (() => {
      if (!className) return rawStyle;
      let resultStyle: any = {};
      if (cssNames.length) {
        if (extraInfo) {
          resultStyle = getMemoCascadeStyle(memoId, () => {
            // 表示在迭代循环中，按需添加伪类
            const cssNameList: any[] = ['*'];
            cssNames.forEach((item, index) => {
              const cssName = item;
              const isEmpty = childList.length === 0;
              const isOnlyChild = childList.length === 1;
              Object.assign(styleFnArgs, { isEmpty, isOnlyChild });
              cssNameList.push(typeof styleSet[cssName] === 'function' ? [cssName, currentIndex, styleFnArgs] : cssName);
              if (currentIndex !== undefined) {
                index === 0 && cssNameList.push(`*:nth-child(${currentIndex})`);
                cssNameList.push(`${cssName}:nth-child(${currentIndex})`);
                if (isOdd) {
                  index === 0 && cssNameList.push('*:nth-child(odd)');
                  cssNameList.push(`${cssName}:nth-child(odd)`);
                }
                if (isEven) {
                  index === 0 && cssNameList.push('*:nth-child(even)');
                  cssNameList.push(`${cssName}:nth-child(even)`);
                }
                if (isFirst) {
                  index === 0 && cssNameList.push('*:first-child');
                  cssNameList.push(`${cssName}:first-child`);
                }
                if (isLast) {
                  index === 0 && cssNameList.push('*:last-child');
                  cssNameList.push(`${cssName}:last-child`);
                }
                if (isEmpty) {
                  index === 0 && cssNameList.push('*:empty');
                  cssNameList.push(`${cssName}:empty`);
                }
                if (isOnlyChild) {
                  index === 0 && cssNameList.push('*:only-child');
                  cssNameList.push(`${cssName}:only-child`);
                }
              }
            });
            const currentClassList = cssNameList.filter(item => !Array.isArray(item));
            let cascadeStyleList: any[] = [];
            currentClassList.forEach(className => {
              const cascadeStyle = styleSet.$$getCascadeStyle$$(className, currentIndex, styleFnArgs);
              if (cascadeStyle) {
                cascadeStyleList.push(cascadeStyle);
              }
            });
            parentClassList.push(currentClassList);
            Object.assign(styleFnArgs, { currentClassList });
            Object.assign($$extrainfo$$, { currentClassList });
            return css('*', sourceComponentName, ...cssNameList, ...cascadeStyleList);
          });
        } else {
          // 根节点会进这个分支
          parentClassList.push(cssNames);
          resultStyle = getMemoCascadeStyle(memoId, () => {
            const cssNameList = cssNames.map(cssName => typeof styleSet[cssName] === 'function' ? [cssName, 1, styleFnArgs] : cssName);
            return css('*', sourceComponentName, ...cssNameList);
          });
        }
      }
      return resultStyle ? Object.assign(resultStyle, rawStyle) : rawStyle;
    })();
    const element = React.createElement(SourceComponent, {
      className,
      style,
      ...others
    }, [renderBefore(), children, renderAfter()]);
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
    cssNames.unshift('*');
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
      const resultStyle: any = getMemoCascadeStyle(memoId, () => {
        const currentClassList = cssNames.filter(item => !Array.isArray(item));
        let cascadeStyleList: any[] = [];
        currentClassList.forEach(item => {
          const className = item;
          const cascadeStyle = styleSet.$$getCascadeStyle$$(className, currentIndex, styleFnArgs);
          if (cascadeStyle) {
            cascadeStyleList.push(cascadeStyle);
          }
        });
        parentClassList.push(currentClassList);
        const cssNameList = cssNames.map(item => {
          const cssName = item;
          return typeof styleSet[cssName] === 'function' ? [cssName, 1, styleFnArgs] : cssName
        });
        Object.assign(styleFnArgs, { currentClassList });
        Object.assign($$extrainfo$$, { currentClassList });
        return css('*', sourceComponentName, ...cssNameList, ...cascadeStyleList);
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
    Object.assign(globalComponents[key], { componentName })
  });

  return globalComponents;
};

// 创建 Taro 的样式


// 创建 RN 的样式
