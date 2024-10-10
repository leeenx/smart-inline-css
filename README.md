# 介绍

提供给 ReactJs 的纯内联样式框架。可以使用 npm 安装

```bash
npm install smart-inline-css
```

# 基础用法

```ts
// index.css.ts 文件
import { createCss } from 'smart-inline-css';
import { rem } from './utils';

// 创建内联样式
export default createCss({
  'tab-content': {
    padding: `${rem(100)} ${rem(50)}`,
    fontSize: rem(30),
    textAlign: "center",
    backgroundColor: "#FAFBFC",
  },
  'tab-content--vertical': {
    height: "200px",
    padding: "100px 50",
    fontSize: 30,
    textAlign: "center",
    boxSizing: "border-box",
    backgroundColor: "#FAFBFC",
  }
});
```

在 jsx 中引用内联样式
```ts
import css from './index.css';

export default () => {
  return (
    <div className="page">
      <div style={css('tab-content')}></div>
      <div style={css('tab-content', 'tab-content--vertical')}></div>
    </div>
  );
}
```

可以创建函数样式，如下：
```ts
// index.css.ts 文件
import { createCss } from 'smart-inline-css';
import { rem } from './utils';

// 创建内联样式
export default createCss({
  'tab-content'(type) {
    const style = {
      padding: `${rem(100)} ${rem(50)}`,
      fontSize: rem(30),
      textAlign: "center",
      backgroundColor: "#FAFBFC",
    };
    if (type === 'vertical') {
      Object.assign(style, {
        height: "200px",
        padding: "100px 50",
        fontSize: 30,
        textAlign: "center",
        boxSizing: "border-box",
        backgroundColor: "#FAFBFC",
      });
    }
    return style;
  }
});
```

```ts
import css from './index.css';

export default () => {
  return (
    <div className="page">
      <div style={css('tab-content')}></div>
      <div style={css(['tab-content', 'vertical'])}></div>
    </div>
  );
}
```
遇到 `数组` 会被识别为函数类型，第一个元素为函数名，之后的被识别为函数入参。

# 全局样式

页面通常都会有一引起基础类的全局样式。可以通过 `setGlobalStyle` 方法来注册全局样式，如下：
```ts
import { setGlobalStyle } from "../smart-style";

// 全局样式
import { setGlobalStyle } from "../smart-style";

// 全局样式
setGlobalStyle({
  item: {
    fontSize: '16px',
    lineHeight: '1.5'
  }
});
```


# 高级功能

结合 `componentBindCss` 方法可以开启高级功能，如下：

```ts
// utils.ts，封装一个通用方法，用于创建带样式的组件
import { componentBindCss } from "../component-bind-css";
import { createCss } from "../smart-style";
import * as TaroComponents from '@tarojs/components';

import type { StyleSet } from "./smart-style";

type Css = (...args) => StyleSet;

// 在 Taro 环境下就比较简单如下：
const taroComponentBindCss = (css: Css) => {
    return componentBindCss<typeof TaroComponents>(css, TaroComponents);
};

export default (styleSet: StyleSet) => taroComponentBindCss(createCss(styleSet));
```

如果不是在 Taro 环境下开发，即有一套自主的基础组件的话，需要麻烦一些。如下：

```ts
// utils.ts，封装一个通用方法，用于创建带样式的组件
import { componentBindCss } from "../component-bind-css";
import { createCss } from "../smart-style";
import * as baseComponents from './base-components';

import type { StyleSet } from "../smart-style";

// 源基础数组
const sourceComponents = baseComponents;

/**
 * 容器组件（即可以加 children 的组件）的 mapping，按具体的基础组件配
 * 置，左侧是 Taro Components 的容器组件名；如果与 Taro Components
 * 没有一一对应关系，可以直接使用当前基础组件的名字。但需要保留「Text」与「View」
 * 因为这两个组件可能会被用于模拟伪元素节点
 */
const containerComponentMapping = {
  'View': 'View',
  'Text': 'Text',
  'Button': 'Button',
};

/**
 * 多页面的情况下，建议对 componentBindCss + createCss 进行二次封装，
 * 简化调用成本，例如以下的 createComponents
 */

export const createComponentsBindCss = (css: StyleSet) => componentBindCss<typeof sourceComponents>(createCss(css), sourceComponents, containerComponentMapping);
```

以下是


## 支持以下伪类
- :nth-child(n)
- :nth-child(odd)
- :nth-child(even)
- :first-child
- :last-child
- :empty
- :only-child

与原生 css 不同的是，上面的伪类存在优先级，优先级即它们的排列顺序。

** 支持伪类（用 Text 组件生成的真实元素）**
- ::before
- ::after

注意与写伪类一样，需要写 `content: ''`，否则伪素将不会被生成。

## 支持级联

```ts
// 样式文件 index.css.ts
export default createComponentsBindCss({
  'wrap': {
    width: '100%',
    height: '100vh'
  },
  'item': {
    '&:first-child': {
      color: 'blue',
      'text': {
        color: 'red'
      }
    }
  }
});
```

```tsx
// 页面，index.tsx
import React, { memo } from "react";
import components from './index.css';

const { View, Text, Fragment } = components;

export default memo(() => {

  return (
    <View className="wrap">
      <View className="item">1111111</View>
      <View className="item">2222222</View>
      <View className="item">3</View>
      <Fragment>
        {
          [1, 2, 3].map(item => (
            <View className="item" key={item}>
              <Text className="text">{ item }</Text>
            </View>
          ))
        }
      </Fragment>
    </View>
  );
});
```

## 高级函数样式

样式如下:
```ts
export default createComponentsBindCss({
  wrap: {
    width: '100%',
    height: '100vh'
  },
  item(index: number, others: any) {
    // 可以有从 others.props 获取当前元素的 props
    console.log('-----others', others);
    switch(index) {
      case 1:
        return { color: 'green' };
      case 2:
        return { color: 'yellow' };
      default:
        return { color: 'gray' };
    }
  },
});
```

函数样式的参数可以从组件的 props 上获取，如果有传参可以把参数直接挂载在 props 上。
**注意**，因为性能问题，开启了高级功能后会使用缓存样式，即当前样式与其祖先节点的样式都未变更的前提下，样式会直接从缓存中读取；如果有动态传参的需要，可以考虑在 `className` 加一个 `tag` 类名，在需要更新样式的时，更新这个 tag 的值。
