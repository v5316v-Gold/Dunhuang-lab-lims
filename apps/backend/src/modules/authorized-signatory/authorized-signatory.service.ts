// =====================================================
// 授权签字人服务(W1 架构 — CNAS-CL01:2018 §7.5.3)
// =====================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateAuthorizedSignatoryDto, UpdateAuthorizedSignatoryDto } from './dto/authorized-signatory.dto';

@Injectable()
export class AuthorizedSignatoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** 列表(可按是否生效过滤) */
  async findAll(activeOnly = false) {
    const where: Prisma.AuthorizedSignatoryWhereInput = activeOnly
      ? { isActive: true, effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] }
      : {};
    return this.prisma.authorizedSignatory.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { effectiveFrom: 'desc' }],
      include: {
        user: { select: { id: true, username: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true } },
        approvalDoc: { select: { id: true, originalName: true } },
      },
    });
  }

  async findOne(id: string) {
    const s = await this.prisma.authorizedSignatory.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, name: true, role: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });
    if (!s) throw new NotFoundException(`授权签字人 ${id} 不存在`);
    return s;
  }

  /** 按 userId 查当前生效的签字人(SodService 签发校验用) */
  async findActiveByUser(userId: string) {
    return this.prisma.authorizedSignatory.findFirst({
      where: {
        userId,
        isActive: true,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
    });
  }

  async create(dto: CreateAuthorizedSignatoryDto, approvedById: string) {
    return this.prisma.authorizedSignatory.create({
      data: {
        userId: dto.userId,
        methods: dto.methods ?? [],
        sampleTypes: dto.sampleTypes ?? [],
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        approvedById,
        approvalDocFileId: dto.approvalDocFileId,
        description: dto.description,
      },
    });
  }

  async update(id: string, dto: UpdateAuthorizedSignatoryDto) {
    await this.findOne(id);
    return this.prisma.authorizedSignatory.update({
      where: { id },
      data: {
        methods: dto.methods,
        sampleTypes: dto.sampleTypes,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
        effectiveTo: dto.effectiveTo === null ? null : dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
        description: dto.description,
        approvalDocFileId: dto.approvalDocFileId,
      },
    });
  }

  /** 停用(软删除) */
  async disable(id: string) {
    await this.findOne(id);
    return this.prisma.authorizedSignatory.update({
      where: { id },
      data: { isActive: false, effectiveTo: new Date() },
    });
  }
}
