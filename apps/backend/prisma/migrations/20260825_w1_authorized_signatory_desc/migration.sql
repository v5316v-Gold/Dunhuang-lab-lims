-- 补 AuthorizedSignatory 遗漏的 description 字段
ALTER TABLE "authorized_signatories" ADD COLUMN "description" TEXT;
