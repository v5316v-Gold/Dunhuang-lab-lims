// =====================================================
// 检测仪器数据上报端点
// POST /api/v1/instruments/data
// Headers:
//   X-Instrument-Cert-SN: <证书序列号,用于识别设备>
//   X-Instrument-Timestamp: <ISO 时间戳>
//   X-Instrument-Signature: <sha256(payload + secret)>
// Body:
//   仪器原始数据(JSON)
// =====================================================

import { Body, Controller, ForbiddenException, Headers, HttpCode, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { InstrumentDataService } from './instrument-data.service';
import { InstrumentRegistryService } from './instrument-registry.service';

@ApiTags('instruments')
@Controller('instruments')
export class InstrumentDataController {
  constructor(
    private readonly data: InstrumentDataService,
    private readonly registry: InstrumentRegistryService,
  ) {}

  @Post('data')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: '检测仪器数据上报(mTLS + 签名)' })
  async receive(
    @Headers('x-instrument-cert-sn') certSn: string,
    @Headers('x-instrument-timestamp') timestamp: string,
    @Headers('x-instrument-signature') signature: string,
    @Body() body: unknown,
  ): Promise<{ accepted: true; streamId: string }> {
    // 1. 校验头部
    if (!certSn || !timestamp || !signature) {
      throw new UnauthorizedException('缺少必要的 Header(X-Instrument-Cert-SN/-Timestamp/-Signature)');
    }

    // 2. 查白名单
    const device = await this.registry.findByCertSerial(certSn);
    if (!device) {
      throw new ForbiddenException(`设备证书 ${certSn} 未在白名单中`);
    }
    if (!device.enabled) {
      throw new ForbiddenException(`设备 ${device.name} 已停用`);
    }

    // 3. 校验时间戳(防重放:±5 分钟)
    const ts = Date.parse(timestamp);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
      throw new UnauthorizedException('时间戳无效或超出容差');
    }

    // 4. 校验签名
    const payload = JSON.stringify(body);
    const expectedSig = await this.data.computeSignature(payload, timestamp, device.sharedSecret);
    if (expectedSig !== signature.toLowerCase()) {
      throw new UnauthorizedException('签名校验失败');
    }

    // 5. 入 Redis Stream
    const streamId = await this.data.enqueue({
      instrumentId: device.id,
      instrumentCode: device.code,
      receivedAt: new Date(),
      payload: body as Record<string, unknown>,
    });

    return { accepted: true, streamId };
  }
}
