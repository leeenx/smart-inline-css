type PureStyle = Record<string, string | number>;
type FnStyle = (...args: any[]) => PureStyle | undefined;
interface StyleValue<T> {
    [key: string]: T;
}
type Style = Record<string, string | number | PureStyle | FnStyle> | StyleValue<Style> | FnStyle;
export type StyleSet = Record<string, Style>;
export declare const setGlobalStyle: (styleSet: StyleSet) => void;
export declare function createCss(styleSet: StyleSet): (...args: any[]) => any;
export {};
