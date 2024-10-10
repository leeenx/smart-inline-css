declare module "src/smart-style" {
    type PureStyle = Record<string, string | number>;
    type FnStyle = (...args: any[]) => PureStyle | undefined;
    interface StyleValue<T> {
        [key: string]: T;
    }
    type Style = Record<string, string | number | PureStyle | FnStyle> | StyleValue<Style> | FnStyle;
    export type StyleSet = Record<string, Style>;
    export const setGlobalStyle: (styleSet: StyleSet) => void;
    export function createCss(styleSet: StyleSet): (...args: any[]) => any;
}
declare module "src/component-bind-css" {
    import { Fragment } from "react";
    type Css = (...args: any[]) => any;
    export function componentBindCss<T>(css: Css, sourceGlobalComponents: T, containerComponentMapping?: Record<string, string>): T & {
        Fragment: typeof Fragment;
    };
}
declare module "src/index" {
    export * from "src/smart-style";
    export * from "src/component-bind-css";
}
