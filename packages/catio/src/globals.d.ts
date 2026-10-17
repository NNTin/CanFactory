/**
 * The one host global the catio domain uses. The package is compiled without the DOM library or Node's types (tsconfig.json), so
 * that a browser or Node global such as the web storage cannot be used here by mistake; this declares the part of them it may use.
 */
declare function structuredClone<T>(value: T): T;
