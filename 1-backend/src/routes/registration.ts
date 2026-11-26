import { Router } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { currentWorkspace, prisma } from '../db.js';
import { hashPassword, passwordProblem } from '../auth.js';
import { provisionRoles } from '../roles.js';

export const registrationRouter = Router();
const registration = z.object({
  companyName: z.string().trim().min(2).max(150),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(72),
  activationKey: z.string().min(1).max(256),
}).strict();
const digest = (value: string) => createHash('sha256').update(value).digest();

registrationRouter.post('/auth/register', async (req, res) => {
  const workspace = currentWorkspace();
  const parsed = registration.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Kiểm tra tên doanh nghiệp, họ tên, email, mật khẩu và mã kích hoạt.' });
  const { activationKey, email, name, companyName, password } = parsed.data;
  if (!workspace?.activationKey || !timingSafeEqual(digest(workspace.activationKey), digest(activationKey))) {
    return res.status(403).json({ error: 'Mã kích hoạt doanh nghiệp không hợp lệ.' });
  }
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ error: problem });
  const passwordHash = await hashPassword(password);
  const created = await prisma.$transaction(async tx => {
    // The conditional update locks the single identity row until commit.
    const claim = await tx.workspaceIdentity.updateMany({
      where: { id: 1, code: workspace.code, activated: false }, data: { activated: true },
    });
    if (!claim.count) return false;
    if (await tx.user.count()) throw new ExistingAccounts();
    await provisionRoles(tx);
    await tx.competencyCategory.createMany({ data: [
      { code: 'COR', name: 'Cốt lõi', displayOrder: 1 },
      { code: 'LEA', name: 'Lãnh đạo', displayOrder: 2 },
      { code: 'FUN', name: 'Chuyên môn', displayOrder: 3 },
    ] });
    await tx.proficiencyScale.create({ data: {
      code: 'LEVEL-5', name: 'Thang năng lực 5 mức', isDefault: true,
      levels: { create: [1, 2, 3, 4, 5].map(levelNumber => ({ levelNumber, label: 'Mức ' + levelNumber })) },
    } });
    const role = await tx.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
    const user = await tx.user.create({ data: {
      name, email, passwordHash, userRoles: { create: { roleId: role.id } },
    } });
    await tx.orgUnit.create({ data: { code: 'HQ', name: companyName, type: 'GROUP', tier: 0 } });
    await tx.auditLog.create({ data: { action: 'CREATE', entityType: 'Workspace', entityId: workspace.code, entityName: companyName, actorId: user.id, actorEmail: email } });
    return true;
  }, { timeout: 30000 }).catch(error => {
    if (error instanceof ExistingAccounts) return false;
    throw error;
  });
  if (!created) return res.status(409).json({ error: 'Doanh nghiệp đã có tài khoản. Hãy đăng nhập hoặc liên hệ quản trị viên.' });
  res.status(201).json({ email });
});

class ExistingAccounts extends Error {}
