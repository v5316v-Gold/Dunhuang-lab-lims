// =====================================================
// xlsx (SheetJS) 类型声明 — W3-A 手动安装,无官方 @types
// =====================================================

declare module 'xlsx' {
  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
  }
  export interface WorkSheet {
    [cell: string]: any;
  }
  export interface ParsingOptions {
    type?: 'base64' | 'binary' | 'buffer' | 'file' | 'array';
  }
  export interface WritingOptions {
    type?: 'base64' | 'binary' | 'buffer' | 'file' | 'array';
    bookType?: string;
  }

  export function read(data: any, opts?: ParsingOptions): WorkBook;
  export const utils: {
    book_new(): WorkBook;
    book_append_sheet(wb: WorkBook, ws: WorkSheet, name?: string): void;
    aoa_to_sheet(data: any[][]): WorkSheet;
    sheet_to_json<T = any>(sheet: WorkSheet, opts?: any): T[];
  };
  export function write(wb: WorkBook, opts?: WritingOptions): any;
  export const version: string;
}
