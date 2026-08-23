// =====================================================
// Import Handler 注册表 — W3-A
// 22 个实体 → handler 实例
// =====================================================

import { ImportEntityType } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { ImportHandler } from '../handler.interface';

import { StaffHandler } from './staff.handler';
import {
  SampleWorkshopHandler, SampleOverseasHandler, SampleInboundHandler,
  SampleOutboundHandler, SampleInventoryHandler,
} from './sample.handlers';
import {
  TestReceiptDomesticHandler, TestReceiptOverseasHandler,
  TestRecordDomesticHandler, TestRecordOverseasHandler,
} from './test.handlers';
import {
  ContainerHandler, GasPurchaseHandler, GasUsageHandler, GasInventoryHandler,
  ReagentInboundHandler, ReagentOutboundHandler, ReagentInventoryHandler, ReagentUsageHandler,
} from './consumables.handlers';
import {
  EquipmentHandler, EquipmentCalibrationHandler, EquipmentMaintenanceHandler, WasteRecordHandler,
} from './equipment-waste.handlers';

export class ImportHandlerRegistry {
  private static instance: ImportHandlerRegistry;
  private handlers = new Map<ImportEntityType, ImportHandler>();

  static getInstance(prisma: PrismaService): ImportHandlerRegistry {
    if (!ImportHandlerRegistry.instance) {
      ImportHandlerRegistry.instance = new ImportHandlerRegistry(prisma);
    }
    return ImportHandlerRegistry.instance;
  }

  private constructor(prisma: PrismaService) {
    const deps = { prisma };
    const all: ImportHandler[] = [
      new StaffHandler(),
      new SampleWorkshopHandler(), new SampleOverseasHandler(),
      new SampleInboundHandler(), new SampleOutboundHandler(), new SampleInventoryHandler(),
      new TestReceiptDomesticHandler(), new TestReceiptOverseasHandler(),
      new TestRecordDomesticHandler(), new TestRecordOverseasHandler(),
      new ContainerHandler(),
      new GasPurchaseHandler(), new GasUsageHandler(), new GasInventoryHandler(),
      new ReagentInboundHandler(), new ReagentOutboundHandler(),
      new ReagentInventoryHandler(), new ReagentUsageHandler(),
      new EquipmentHandler(), new EquipmentCalibrationHandler(),
      new EquipmentMaintenanceHandler(), new WasteRecordHandler(),
    ];
    for (const h of all) {
      this.handlers.set(h.entityType, h);
    }
  }

  get(entityType: ImportEntityType): ImportHandler {
    const h = this.handlers.get(entityType);
    if (!h) throw new Error(`未注册的实体类型: ${entityType}`);
    return h;
  }

  list(): ImportEntityType[] {
    return [...this.handlers.keys()];
  }
}
