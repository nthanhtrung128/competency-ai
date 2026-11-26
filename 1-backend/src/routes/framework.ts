import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { currentWorkspace, prisma } from '../db.js';
import { authenticate, requirePermission, resolveScope, audit } from '../auth.js';

/**
 * Các endpoint phục vụ giao diện CompetencyAI (2-frontend):
 *   GET   /bootstrap                     — một lần gọi, trả đủ dữ liệu cho giao diện
 *   PATCH /competencies/:id/owner        — gán đơn vị chủ quản (QT05)
 *   POST  /competencies/:id/versions     — tạo bản nháp (DRAFT) từ bản đang hiệu lực
 *   PATCH /competency-versions/:id       — sửa bản nháp (chỉ DRAFT)
 *   GET   /job-roles                     — Job Architecture
 *   PUT   /job-roles/:code/requirements  — duyệt / sửa yêu cầu năng lực của vai trò
 */
export const frameworkRouter = Router();

const LevelsSchema = z
  .object({
    behavioralIndicators: z.array(z.object({ level: z.number().int().min(1).max(5), indicator: z.string() })).optional(),
    positiveIndicators: z.array(z.string()).optional(),
    negativeIndicators: z.array(z.string()).optional(),
    overuseWarning: z.string().nullable().optional(),
  })
  .passthrough();

type LevelsJson = {
  behavioralIndicators?: Array<{ level: number; indicator: string }>;
  [k: string]: unknown;
};

function completeness(levels: LevelsJson) {
  const n = new Set((levels.behavioralIndicators ?? []).filter((b) => b.indicator?.trim()).map((b) => b.level)).size;
  return n === 5 ? 'FULL' : n > 0 ? 'PARTIAL' : 'NONE';
}

// ================================================================ BOOTSTRAP

frameworkRouter.post('/competencies', authenticate, requirePermission('competency:author'), async (req, res) => {
  if (!currentWorkspace()) return res.status(403).json({ error: 'Từ điển thí điểm đang được quản lý theo QĐ-01.' });
  const parsed = z.object({
    code: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,40}$/).transform(code => code.toUpperCase()),
    name: z.string().trim().min(1).max(200), definition: z.string().trim().max(5000),
    categoryCode: z.string(), owningUnit: z.string().trim().max(200).nullable(),
    levels: LevelsSchema,
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Kiểm tra tên, nhóm và mã năng lực (chữ, số, gạch nối hoặc gạch dưới).' });
  const { code, name, definition, categoryCode, owningUnit, levels } = parsed.data;
  const category = await prisma.competencyCategory.findUnique({ where: { code: categoryCode } });
  if (!category) return res.status(400).json({ error: 'Nhóm năng lực không tồn tại.' });
  const scale = await prisma.proficiencyScale.findFirstOrThrow({ where: { isDefault: true } });
  try {
    const competency = await prisma.$transaction(async tx => {
      const created = await tx.competency.create({ data: {
        code, name, definition, categoryId: category.id, scaleId: scale.id, owningUnit, hasOwner: !!owningUnit,
        versions: { create: { title: name, definition, levels: { behavioralIndicators: levels.behavioralIndicators ?? [] } } },
      } });
      await tx.auditLog.create({ data: { action: 'CREATE', entityType: 'Competency', entityId: created.id, entityName: name, actorId: req.user!.id, actorEmail: req.user!.email } });
      return created;
    });
    return res.status(201).json({ id: competency.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ error: 'Mã năng lực đã tồn tại.' });
    throw error;
  }
});

frameworkRouter.get('/bootstrap', authenticate, requirePermission('competency:read'), async (req, res) => {
  const user = req.user!;
  const canAuthor = user.permissions.includes('competency:author') || user.permissions.includes('competency:publish');
  const canSeeOrg = user.permissions.includes('org:read') || user.permissions.includes('org:read_all');
  const scope = await resolveScope(user);

  const [scale, categories, competencies, orgUnits, jobFamilies, jobLevels, jobRoles] = await Promise.all([
    prisma.proficiencyScale.findFirst({
      where: { isDefault: true },
      include: { levels: { orderBy: { levelNumber: 'asc' } } },
    }),
    prisma.competencyCategory.findMany({ orderBy: { displayOrder: 'asc' } }),
    prisma.competency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      include: {
        category: { select: { code: true } },
        // Người không có quyền soạn thảo chỉ thấy bản đã ban hành
        versions: {
          where: canAuthor ? {} : { status: 'PUBLISHED' },
          orderBy: { version: 'asc' },
        },
      },
    }),
    canSeeOrg
      ? prisma.orgUnit.findMany({
          where: scope === null ? { isActive: true } : { isActive: true, id: { in: scope } },
          orderBy: [{ tier: 'asc' }, { code: 'asc' }],
          include: {
            parent: { select: { code: true } },
            headEmployee: { select: { fullName: true } },
            _count: { select: { employees: true } },
          },
        })
      : Promise.resolve([]),
    prisma.jobFamily.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    prisma.jobLevel.findMany({ orderBy: { displayOrder: 'desc' } }),
    prisma.jobRole.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
      include: {
        jobFamily: { select: { code: true } },
        jobLevel: { select: { code: true } },
        requirements: { include: { competency: { select: { code: true } } }, orderBy: { sourceLabel: 'asc' } },
      },
    }),
  ]);

  res.json({
    serverTime: new Date().toISOString(),
    me: {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      permissions: user.permissions,
      scope: scope === null ? 'TOAN_BO' : scope,
      employeeId: user.employeeId,
      mustChangePassword: user.mustChangePassword,
    },
    proficiencyScale: scale,
    categories,
    competencies: competencies.map((c) => ({ ...c, categoryCode: c.category.code })),
    orgUnits: orgUnits.map((u) => ({
      id: u.id,
      code: u.code,
      name: u.name,
      nameEn: u.nameEn,
      type: u.type,
      tier: u.tier,
      parentId: u.parentId,
      parentCode: u.parent?.code ?? null,
      note: u.note,
      headDisplay: u.headEmployee?.fullName ?? 'Chưa bổ nhiệm',
      employeeCount: u._count.employees,
    })),
    jobFamilies,
    jobLevels,
    jobRoles: jobRoles.map((r) => ({
      code: r.code,
      title: r.title,
      titleEn: r.titleEn,
      careerStream: r.careerStream,
      jobFamily: r.jobFamily?.code ?? null,
      jobLevel: r.jobLevel?.code ?? null,
      updatedAt: r.updatedAt,
      requirements: r.requirements.map((q) => ({
        id: q.id,
        sourceLabel: q.sourceLabel,
        competency: q.competency?.code ?? null,
        requiredLevel: q.requiredLevel,
        mappingStatus: q.mappingStatus,
        mappingConfidence: q.mappingConfidence,
        note: q.note,
      })),
    })),
  });
});

// ================================================================ ĐƠN VỊ CHỦ QUẢN

frameworkRouter.patch(
  '/competencies/:id/owner',
  authenticate,
  // Gán chủ quản là quyết định quản trị (QĐ-03) → chỉ người có quyền ban hành
  requirePermission('competency:publish'),
  async (req, res) => {
    const body = z.object({ owningUnit: z.string().trim().min(2).max(200) }).safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: 'Thiếu tên đơn vị chủ quản' });

    const before = await prisma.competency.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Không tìm thấy năng lực' });

    const after = await prisma.competency.update({
      where: { id: before.id },
      data: { owningUnit: body.data.owningUnit, hasOwner: true },
    });
    // entityName bắt đầu bằng OWNER: → seed-competencies sẽ không ghi đè khi nạp lại file
    await audit(req, 'UPDATE', 'Competency', after.id, {
      entityName: `OWNER:${after.code}`,
      oldValues: { owningUnit: before.owningUnit, hasOwner: before.hasOwner },
      newValues: { owningUnit: after.owningUnit, hasOwner: true },
    });
    res.json(after);
  },
);

// ================================================================ BẢN NHÁP

frameworkRouter.post(
  '/competencies/:id/versions',
  authenticate,
  requirePermission('competency:author'),
  async (req, res) => {
    const body = z
      .object({
        title: z.string().trim().min(1).optional(),
        definition: z.string().trim().min(1).optional(),
        levels: LevelsSchema.optional(),
        changeNote: z.string().trim().max(500).optional(),
      })
      .safeParse(req.body ?? {});
    if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ', detail: body.error.issues });

    const comp = await prisma.competency.findUnique({
      where: { id: req.params.id },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!comp) return res.status(404).json({ error: 'Không tìm thấy năng lực' });

    const openDraft = comp.versions.find((v) => v.status === 'DRAFT');
    if (openDraft) {
      return res.status(409).json({
        error: `Năng lực ${comp.code} đã có bản nháp v${openDraft.version}. Sửa hoặc ban hành bản đó trước.`,
        draftId: openDraft.id,
      });
    }

    const base = comp.versions.find((v) => v.id === comp.currentVersionId) ?? comp.versions[0];
    const baseLevels = (base?.levels ?? {}) as LevelsJson;
    const levels: LevelsJson = { ...baseLevels, ...(body.data.levels ?? {}) };
    levels.completeness = completeness(levels);
    if (body.data.changeNote) levels.changeNote = body.data.changeNote;

    const draft = await prisma.competencyVersion.create({
      data: {
        competencyId: comp.id,
        version: (comp.versions[0]?.version ?? 0) + 1,
        status: 'DRAFT',
        title: body.data.title ?? base?.title ?? comp.name,
        definition: body.data.definition ?? base?.definition ?? comp.definition ?? comp.name,
        levels: levels as never,
      },
    });
    await audit(req, 'CREATE', 'CompetencyVersion', draft.id, {
      entityName: `${comp.code} v${draft.version}`,
      newValues: { status: 'DRAFT', fromVersion: base?.version ?? null },
    });
    res.status(201).json(draft);
  },
);

frameworkRouter.patch(
  '/competency-versions/:id',
  authenticate,
  requirePermission('competency:author'),
  async (req, res) => {
    const body = z
      .object({
        title: z.string().trim().min(1).optional(),
        definition: z.string().trim().min(1).optional(),
        levels: LevelsSchema.optional(),
      })
      .safeParse(req.body ?? {});
    if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ', detail: body.error.issues });

    const v = await prisma.competencyVersion.findUnique({ where: { id: req.params.id } });
    if (!v) return res.status(404).json({ error: 'Không tìm thấy phiên bản' });
    if (v.status !== 'DRAFT') {
      return res.status(409).json({
        error: `Phiên bản đang ở trạng thái ${v.status} — không được sửa trực tiếp. Hãy tạo bản nháp mới.`,
      });
    }

    const levels: LevelsJson = { ...((v.levels ?? {}) as LevelsJson), ...(body.data.levels ?? {}) };
    levels.completeness = completeness(levels);

    const after = await prisma.competencyVersion.update({
      where: { id: v.id },
      data: {
        title: body.data.title ?? undefined,
        definition: body.data.definition ?? undefined,
        levels: levels as never,
      },
    });
    await audit(req, 'UPDATE', 'CompetencyVersion', v.id, {
      entityName: v.title,
      oldValues: { levels: v.levels },
      newValues: { levels: after.levels },
    });
    res.json(after);
  },
);

// ================================================================ JOB ARCHITECTURE

frameworkRouter.get('/job-roles', authenticate, requirePermission('competency:read'), async (_req, res) => {
  const roles = await prisma.jobRole.findMany({
    orderBy: { code: 'asc' },
    include: {
      jobFamily: true,
      jobLevel: true,
      requirements: { include: { competency: { select: { code: true, name: true } } } },
    },
  });
  const all = roles.flatMap((r) => r.requirements);
  res.json({
    count: roles.length,
    yeuCau: {
      tong: all.length,
      daDuyet: all.filter((q) => q.mappingStatus === 'APPROVED').length,
      deXuat: all.filter((q) => q.mappingStatus === 'PROPOSED').length,
      chuaDoiChieu: all.filter((q) => q.mappingStatus === 'UNMAPPED').length,
    },
    roles,
  });
});

const RequirementInput = z.object({
  requirements: z
    .array(
      z.object({
        competency: z.string().trim().min(1), // mã Từ điển: CO1, LE2, FU03...
        requiredLevel: z.number().int().min(1).max(5),
      }),
    )
    .max(40),
});

/**
 * Thay toàn bộ yêu cầu năng lực của một vai trò bằng danh sách đã được HR duyệt.
 * Mọi dòng ghi vào đều là APPROVED. Bản cũ được lưu trong nhật ký để truy vết.
 */
frameworkRouter.put(
  '/job-roles/:code/requirements',
  authenticate,
  requirePermission('competency:publish'),
  async (req, res) => {
    const body = RequirementInput.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: 'Dữ liệu không hợp lệ', detail: body.error.issues });

    const role = await prisma.jobRole.findUnique({
      where: { code: req.params.code },
      include: { requirements: { include: { competency: { select: { code: true } } } } },
    });
    if (!role) return res.status(404).json({ error: 'Không tìm thấy vai trò' });

    const codes = [...new Set(body.data.requirements.map((r) => r.competency))];
    if (codes.length !== body.data.requirements.length) {
      return res.status(400).json({ error: 'Một năng lực bị khai báo hai lần' });
    }
    const comps = await prisma.competency.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
    const idByCode = new Map(comps.map((c) => [c.code, c.id]));
    const unknown = codes.filter((c) => !idByCode.has(c));
    if (unknown.length) {
      return res.status(400).json({ error: `Mã năng lực không có trong Từ điển: ${unknown.join(', ')}` });
    }

    await prisma.$transaction([
      prisma.jobRoleRequirement.deleteMany({ where: { jobRoleId: role.id } }),
      prisma.jobRoleRequirement.createMany({
        data: body.data.requirements.map((r) => ({
          jobRoleId: role.id,
          sourceLabel: r.competency,
          competencyId: idByCode.get(r.competency)!,
          requiredLevel: r.requiredLevel,
          mappingStatus: 'APPROVED',
          mappingConfidence: null,
          note: `Duyệt trên app bởi ${req.user!.email}`,
        })),
      }),
      prisma.jobRole.update({ where: { id: role.id }, data: { updatedAt: new Date() } }),
    ]);

    await audit(req, 'UPDATE', 'JobRole', role.id, {
      entityName: `${role.code} ${role.title}`,
      oldValues: role.requirements.map((q) => ({
        sourceLabel: q.sourceLabel,
        competency: q.competency?.code ?? null,
        requiredLevel: q.requiredLevel,
        mappingStatus: q.mappingStatus,
      })),
      newValues: body.data.requirements,
    });
    res.json({ ok: true, role: role.code, count: body.data.requirements.length });
  },
);
