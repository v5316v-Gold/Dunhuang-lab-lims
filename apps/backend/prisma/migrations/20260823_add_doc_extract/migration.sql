-- DOC/DOCX 文档上传 + 文本识别
-- 1) FileCategory 增加 DOCUMENT
ALTER TYPE "FileCategory" ADD VALUE 'DOCUMENT';

-- 2) FileAttachment 增加提取正文/元信息
ALTER TABLE "file_attachments" ADD COLUMN "doc_meta" JSONB,
ADD COLUMN "extracted_text" TEXT;
