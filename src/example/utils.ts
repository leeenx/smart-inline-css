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
