declare module "js-yaml" {
  export type Schema = object;
  export interface LoadOptions {
    schema?: Schema;
    filename?: string;
    onWarning?: (warning: Error) => void;
    json?: boolean;
  }
  export const JSON_SCHEMA: Schema;
  export const CORE_SCHEMA: Schema;
  export const DEFAULT_SCHEMA: Schema;
  export const FAILSAFE_SCHEMA: Schema;
  export function load(input: string, options?: LoadOptions): unknown;
  export function loadAll(
    input: string,
    iterator: (doc: unknown) => void,
    options?: LoadOptions,
  ): void;
  export function dump(obj: unknown, options?: object): string;
}
