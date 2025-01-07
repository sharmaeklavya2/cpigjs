// from https://github.com/mdaines/viz-js/blob/v3/packages/viz/types/index.d.ts
declare module "dotviz" {
    export interface RenderOptions {
        format?: string;
        engine?: string;
        yInvert?: boolean;
        reduce?: boolean;
    }

    export class Viz {
        renderSVGElement(input: string, options?: RenderOptions): SVGSVGElement;
    }

    export function instance(): Promise<Viz>;
}
