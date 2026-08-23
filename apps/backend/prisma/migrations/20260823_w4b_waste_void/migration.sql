-- W4-interaction: WasteStatus 增加 VOID(误录作废)
ALTER TYPE "WasteStatus" ADD VALUE IF NOT EXISTS 'VOID';
