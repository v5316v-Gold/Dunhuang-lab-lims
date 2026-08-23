// =====================================================
// word-extractor 类型声明(手动安装,无官方 @types)
// 参考: https://github.com/morungos/node-word-extractor
// =====================================================

declare module 'word-extractor' {
  interface WordDocument {
    /** 正文纯文本 */
    getBody(): string;
    getHeaders(): { [key: string]: string };
    getFooters(): { [key: string]: string };
  }

  class WordExtractor {
    constructor();
    /** 支持 Buffer(docx zip / doc OLE)与文件路径 */
    extract(input: Buffer | string): Promise<WordDocument>;
  }

  export = WordExtractor;
}
