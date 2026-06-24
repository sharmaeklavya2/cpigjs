declare module "funcToForm" {
    type converterT = (input: string) => any;
    type runT = (input: any, stdout: Ostream) => any;
    export class CheckBoxWidget {
        constructor(options: {defVal?: boolean = false} = {});
    }
    export class SelectOption {
        constructor(options: {name?: string, value?: string, text?: string} = {});
    }
    export class SelectWidget {
        constructor(options: readonly SelectOption[], defName?: string);
    }
    export class TextWidget {
        constructor(options: {converter?: converterT, required?: boolean = true, defVal?: any,
            placeholder?: string, type?: "text" | "textarea"} = {});
    }
    export class Param {
        constructor(name: string, widget: CheckBoxWidget | SelectWidget | TextWidget,
            options: {label?: string, description?: string} = {});
    }
    export class ParamGroup {
        constructor(name?: string, paramList: readonly Param[], options: {
            converter?: converterT, label?: string, description?: string, compact?: boolean} = {});
    }
    export class Ostream {
        log(...args: readonly any[]): void;
        info(...args: readonly any[]): void;
        error(...args: readonly any[]): void;
        warn(...args: readonly any[]): void;
        debug(...args: readonly any[]): void;
        success(...args: readonly any[]): void;

        constructor(name: string, wrapperElem: HTMLElement);
        clear(): void;
        setLane(name: string, attrs: any): void;
        addBreak(): void;
        rawAdd(elem: HTMLElement): void;
        rawLog(args: readonly any[], klasses: readonly string[] = []): void;
        tableRow(row: HTMLElement | readonly string[], head: boolean = false): void;
    }
    export function createForm(wrapperId: string, paramGroup: ParamGroup,
        func: runT, options: {clearOutput?: boolean} = {}): void;
}
