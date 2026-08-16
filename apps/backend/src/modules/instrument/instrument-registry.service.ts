// =====================================================
// 仪器白名单服务
// 存储:数据库表(简化为内存缓存 + DB 查询)
// =====================================================

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface RegisteredInstrument {
  id: string;
  code: string;
  name: string;
  type: string;        // ICP-OES / BALANCE / SPECTRO / ...
  certSerial: string;
  sharedSecret: string;
  enabled: boolean;
  lastSeenAt?: Date;
}

@Injectable()
export class InstrumentRegistryService {
  private readonly logger = new Logger(InstrumentRegistryService.name);
  private cache = new Map<string, RegisteredInstrument>();

  constructor(private readonly prisma: PrismaService) {}

  async findByCertSerial(serial: string): Promise<RegisteredInstrument | null> {
    if (this.cache.has(serial)) {
      return this.cache.get(serial)!;
    }
    // TODO: 真实场景应查 Instrument 表;Phase 1 占位 — 从 Equipment 关联表查
    // 这里先返回 mock,后续接 Equipment 模型
    const equipment = await this.prisma.equipment.findFirst({
      where: {
        serialNumber: serial,
        deletedAt: null,
      },
    });

    if (!equipment) {
      return null;
    }

    const inst: RegisteredInstrument = {
      id: equipment.id,
      code: equipment.code,
      name: equipment.name,
      type: equipment.type,
      certSerial: serial,
      // sharedSecret 应单独存储加密(暂时用设备编号占位,生产必须改)
      sharedSecret: process.env[`INSTRUMENT_SECRET_${equipment.code}`] || equipment.code,
      enabled: equipment.status === 'ACTIVE',
    };

    this.cache.set(serial, inst);
    return inst;
  }

  invalidate(serial: string): void {
    this.cache.delete(serial);
  }
}
