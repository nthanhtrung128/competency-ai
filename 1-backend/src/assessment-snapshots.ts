import { Prisma, type AssessmentCampaign } from '@prisma/client';
import { z } from 'zod';
import { prisma } from './db.js';

const Snapshot = z.object({
  version: z.literal(1), capturedAt: z.string().datetime(),
  jobRoleCode: z.string().nullable(), roleTitle: z.string().nullable(),
  roleRevision: z.number().int().nonnegative().nullable(), approvedAt: z.string().datetime().nullable(),
  requirements: z.array(z.object({ competencyId: z.string(), code: z.string(), requiredLevel: z.number().int().min(1).max(5) })),
});
export type RequirementSnapshot = z.infer<typeof Snapshot>;
export function readRequirementSnapshot(value: unknown): RequirementSnapshot | null {
  const parsed = Snapshot.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function captureRequirements(tx: Prisma.TransactionClient, employeeIds: string[], at: Date) {
  const employees = await tx.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, jobRoleCode: true } });
  const roles = await tx.jobRole.findMany({ where: { code: { in: employees.flatMap(e => e.jobRoleCode ? [e.jobRoleCode] : []) }, isActive: true },
    include: { requirements: { where: { mappingStatus: 'APPROVED', competency: { isActive: true } },
      include: { competency: { select: { code: true, currentVersionId: true } } }, orderBy: { sourceLabel: 'asc' } } } });
  const byCode = new Map(roles.map(role => [role.code, role]));
  return new Map(employees.map(employee => {
    const role = employee.jobRoleCode ? byCode.get(employee.jobRoleCode) : undefined;
    const snapshot: RequirementSnapshot = {
      version: 1, capturedAt: at.toISOString(), jobRoleCode: employee.jobRoleCode,
      roleTitle: role?.title ?? null, roleRevision: role?.revision ?? null, approvedAt: role?.approvedAt?.toISOString() ?? null,
      requirements: (role?.requirements ?? []).flatMap(q => q.competencyId && q.competency?.currentVersionId
        ? [{ competencyId: q.competencyId, code: q.competency.code, requiredLevel: q.requiredLevel }] : []),
    };
    return [employee.id, snapshot];
  }));
}

export class CampaignError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Serialize campaign membership/open/close and read a consistent set of employee, role and requirement records. */
export async function campaignTransaction<T>(id: string, operation: (tx: Prisma.TransactionClient, campaign: AssessmentCampaign) => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try {
      const data = await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM assessment_campaigns WHERE id = ${id} FOR UPDATE`;
        const campaign = await tx.assessmentCampaign.findUnique({ where: { id } });
        if (!campaign) throw new CampaignError(404, 'Không tìm thấy chiến dịch');
        return operation(tx, campaign);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
      return { data, error: null };
    } catch (e) {
      if (e instanceof CampaignError) return { data: null, error: { status: e.status, message: e.message } };
      // Prisma reports serialization/deadlock failures from a raw row lock as P2010 + SQLSTATE.
      if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2034'
        || (e.code === 'P2010' && ['40001', '40P01'].includes(String(e.meta?.code))))) {
        if (attempt < 2) continue;
        return { data: null, error: { status: 409, message: 'Dữ liệu vừa thay đổi. Tải lại chiến dịch và thử lại.' } };
      }
      throw e;
    }
  }
}
