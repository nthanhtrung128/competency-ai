import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../auth.js';
import { currentWorkspace, prisma } from '../db.js';

export const roleProfilesRouter = Router();
roleProfilesRouter.use('/role-profiles', (_req, res, next) => {
  if (!currentWorkspace()) return res.status(404).json({ error: 'Chức năng dành cho cổng doanh nghiệp.' });
  next();
});

const Code = z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/).transform(s => s.toUpperCase());
const Requirements = z.array(z.object({ competency: Code, requiredLevel: z.number().int().min(1).max(5) }).strict()).max(40)
  .refine(rows => new Set(rows.map(row => row.competency)).size === rows.length, 'Năng lực bị trùng.');
const Revision = z.number().int().nonnegative().max(2147483646);

class ProfileError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

roleProfilesRouter.get('/role-profiles', authenticate, requirePermission('competency:read'), async (req, res) => {
  const canDraft = req.user!.permissions.some(p => ['competency:author', 'competency:publish'].includes(p));
  const [roles, competencies] = await Promise.all([
    prisma.jobRole.findMany({ where: { isActive: true }, orderBy: { code: 'asc' }, include: {
      requirements: { where: { mappingStatus: 'APPROVED' }, orderBy: { sourceLabel: 'asc' },
        include: { competency: { select: { code: true, name: true } } } },
    } }),
    prisma.competency.findMany({ where: { isActive: true, scaleId: { not: null } }, orderBy: { code: 'asc' },
      select: { code: true, name: true, currentVersionId: true } }),
  ]);
  res.json({ roles: roles.map(role => ({ ...role, pendingRequirements: canDraft ? role.pendingRequirements : null })), competencies });
});

roleProfilesRouter.post('/role-profiles', authenticate, requirePermission('competency:author'), async (req, res) => {
  const parsed = z.object({ code: Code, title: z.string().trim().min(1).max(200) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Nhập tên và mã chức danh hợp lệ (chữ, số, gạch nối hoặc gạch dưới).' });
  try {
    const role = await prisma.$transaction(async tx => {
      const created = await tx.jobRole.create({ data: { ...parsed.data, pendingRequirements: [] } });
      await tx.auditLog.create({ data: { action: 'CREATE', entityType: 'JobRole', entityId: created.id,
        entityName: created.code, actorId: req.user!.id, actorEmail: req.user!.email, newValues: parsed.data } });
      return created;
    });
    res.status(201).json(role);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return res.status(409).json({ error: 'Mã chức danh đã tồn tại.' });
    throw e;
  }
});

for (const approve of [false, true]) {
  roleProfilesRouter[approve ? 'post' : 'put'](`/role-profiles/:code/${approve ? 'approve' : 'draft'}`,
    authenticate, requirePermission(approve ? 'competency:publish' : 'competency:author'), async (req, res) => {
      const body = (approve ? z.object({ revision: Revision }).strict()
        : z.object({ revision: Revision, requirements: Requirements }).strict()).safeParse(req.body);
      if (!body.success) return res.status(400).json({ error: 'Kiểm tra phiên bản, mã năng lực không trùng và mức yêu cầu từ 1 đến 5.' });
      try {
        const result = await prisma.$transaction(async tx => {
          const role = await tx.jobRole.findUnique({ where: { code: req.params.code }, include: { requirements: true } });
          if (!role || !role.isActive) throw new ProfileError(404, 'Không tìm thấy chức danh.');
          if (role.revision !== body.data.revision) throw new ProfileError(409, 'Hồ sơ đã thay đổi. Tải lại để xem bản mới trước khi lưu hoặc duyệt.');
          const parsed = Requirements.safeParse(approve ? role.pendingRequirements : ('requirements' in body.data ? body.data.requirements : null));
          if (!parsed.success || (approve && !parsed.data.length)) throw new ProfileError(422, 'Cần lưu bản nháp có ít nhất một năng lực trước khi duyệt.');
          const rows = parsed.data;
          const comps = await tx.competency.findMany({ where: { code: { in: rows.map(row => row.competency) } },
            include: { scale: { include: { levels: true } }, versions: { where: { status: 'PUBLISHED' }, select: { id: true } } } });
          for (const row of rows) {
            const c = comps.find(c => c.code === row.competency);
            if (!c?.isActive || !c.scale?.levels.some(level => level.levelNumber === row.requiredLevel)) {
              throw new ProfileError(422, `${row.competency}: năng lực hoặc mức yêu cầu không còn sử dụng.`);
            }
            if (approve && !c.versions.some(version => version.id === c.currentVersionId)) {
              throw new ProfileError(422, `${row.competency}: cần ban hành nội dung năng lực trước khi duyệt hồ sơ.`);
            }
          }
          // Conditional UPDATE takes the row lock. A concurrent edit/approval must retry with the new revision.
          const changed = await tx.jobRole.updateMany({ where: { id: role.id, revision: body.data.revision, isActive: true },
            data: { revision: { increment: 1 }, pendingRequirements: approve ? Prisma.DbNull : rows,
              ...(approve ? { approvedAt: new Date() } : {}) } });
          if (changed.count !== 1) throw new ProfileError(409, 'Hồ sơ đã thay đổi. Tải lại để xem bản mới trước khi lưu hoặc duyệt.');
          if (approve) {
            await tx.jobRoleRequirement.deleteMany({ where: { jobRoleId: role.id } });
            await tx.jobRoleRequirement.createMany({ data: rows.map(row => ({ jobRoleId: role.id,
              sourceLabel: row.competency, competencyId: comps.find(c => c.code === row.competency)!.id,
              requiredLevel: row.requiredLevel, mappingStatus: 'APPROVED' })) });
          }
          await tx.auditLog.create({ data: { action: approve ? 'PUBLISH' : 'UPDATE', entityType: 'JobRole', entityId: role.id,
            entityName: role.code, actorId: req.user!.id, actorEmail: req.user!.email,
            oldValues: { revision: role.revision, requirements: role.requirements.map(q => ({ competency: q.sourceLabel, requiredLevel: q.requiredLevel, mappingStatus: q.mappingStatus })), draft: role.pendingRequirements },
            newValues: { revision: role.revision + 1, requirements: rows, status: approve ? 'APPROVED' : 'DRAFT' } } });
          return { code: role.code, revision: role.revision + 1 };
        });
        res.json(result);
      } catch (e) {
        if (e instanceof ProfileError) return res.status(e.status).json({ error: e.message });
        throw e;
      }
    });
}
