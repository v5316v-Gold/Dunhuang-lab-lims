// =====================================================
// P2-4: QR Code 模块
// =====================================================

import { Global, Module } from '@nestjs/common';
import { QrCodeService } from './qrcode.service';

@Global()
@Module({
  providers: [QrCodeService],
  exports: [QrCodeService],
})
export class QrCodeModule {}