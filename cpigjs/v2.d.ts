declare module "https://sharmaeklavya2.github.io/funcToForm/v2.js" {
    type converterT = (input: string) => any;
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
            placeholder?: string, type?: string} = {});
    }
    export class Param {
        constructor(name: string, widget: CheckBoxWidget | SelectWidget | TextWidget,
            options: {label?: string, description?: string} = {});
    }
    export class ParamGroup {
        constructor(name?: string, paramList: Param[], options: {
            converter?: converterT, label?: string, description?: string, compact?: boolean} = {});
    }
    export function createForm(wrapperId: string, paramGroup: ParamGroup,
        func: (input: any, stdout: Ostream) => any, options: {clearOutput?: boolean} = {}): void;
}
