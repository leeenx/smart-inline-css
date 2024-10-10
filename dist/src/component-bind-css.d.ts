import { Fragment } from "react";
type Css = (...args: any[]) => any;
export declare function componentBindCss<T>(css: Css, sourceGlobalComponents: T, containerComponentMapping?: Record<string, string>): T & {
    Fragment: typeof Fragment;
};
export {};
