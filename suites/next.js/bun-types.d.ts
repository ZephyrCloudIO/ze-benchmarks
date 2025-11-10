/// <reference types="bun-types" />

declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  type TestFunction = () => void | Promise<void> | ((done: (err?: Error) => void) => void);
  interface Test {
    (name: string, fn: TestFunction): void;
    (name: string, fn: TestFunction, timeout: number): void;
    each<T>(items: T[]): ((name: string, fn: (item: T) => void | Promise<void>) => void) & ((name: string, fn: (item: T) => void | Promise<void>, timeout: number) => void);
  }
  export const test: Test;
  export const expect: {
    (value: any): {
      toBe(expected: any): void;
      toBeTruthy(): void;
      toBeFalsy(): void;
      toEqual(expected: any): void;
      toBeGreaterThan(expected: number): void;
      toBeLessThan(expected: number): void;
      toContain(item: any): void;
      toThrow(error?: string | RegExp | Error): void;
      toMatch(pattern: string | RegExp): void;
      not: any;
    };
  };
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
}

declare global {
  var Bun: {
    spawn(args: (string | { cmd: string; args?: string[]; env?: Record<string, string> })[], options?: { 
      cwd?: string;
      stdout?: "pipe" | "inherit" | "ignore";
      stderr?: "pipe" | "inherit" | "ignore";
      env?: Record<string, string>;
    }): {
      exited: Promise<number>;
      stdout: ReadableStream;
      stderr: ReadableStream;
      pid: number;
      kill(code?: number): void;
    };
    env: Record<string, string | undefined>;
  };
}

interface ImportMeta {
  dir?: string;
}

declare global {
  var console: {
    log(...args: any[]): void;
    error(...args: any[]): void;
    warn(...args: any[]): void;
    info(...args: any[]): void;
  };
  
  var setTimeout: (callback: () => void, ms: number) => number;
  var clearTimeout: (id: number) => void;
  
  var TextDecoder: {
    new (): {
      decode(input: ArrayBuffer | Uint8Array): string;
    };
  };
  
  var __dirname: string;
}

declare module "fs/promises" {
  export function readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | any[]>;
  export function readFile(path: string, encoding?: string): Promise<string>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function copyFile(src: string, dest: string): Promise<void>;
  export function stat(path: string): Promise<any>;
  export function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  export function mkdtemp(prefix: string): Promise<string>;
}

declare module "path" {
  export function resolve(...paths: string[]): string;
  export function join(...paths: string[]): string;
}
