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
        constructor(options: SelectOption[], defName?: string);
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
        constructor(name?: string, paramList: Param[], options: {
            converter?: converterT, label?: string, description?: string, compact?: boolean} = {});
    }
    export class Ostream {
        log(...args: any[]): void;
        info(...args: any[]): void;
        error(...args: any[]): void;
        warn(...args: any[]): void;
        debug(...args: any[]): void;
        success(...args: any[]): void;

        constructor(name: string, wrapperElem: HTMLElement);
        clear(): void;
        setLane(name: string, attrs: any): void;
        addBreak(): void;
        rawAdd(elem: HTMLElement): void;
        rawLog(args: any[], klasses: string[] = []): void;
        tableRow(row: HTMLElement | string[], head: boolean = false): void;
    }
    export function createForm(wrapperId: string, paramGroup: ParamGroup,
        func: runT, options: {clearOutput?: boolean} = {}): void;
}
