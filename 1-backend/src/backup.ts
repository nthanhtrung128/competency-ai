import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from './db.js';

/**
 * Sao lưu toàn bộ dữ liệu nghiệp vụ ra một file JSON: npm run backup
 *   - Lưu vào thư mục backups/ (đã có trong .gitignore — KHÔNG đẩy lên GitHub).
 *   - KHÔNG chứa mật khẩu (passwordHash) và refresh token.
 *   - File chứa dữ liệu cá nhân nhân sự: cất ở nơi có kiểm soát truy cập (NĐ 13/2023).
 */
async function main() {
  const p = prisma;
  const data = {
    _meta: { createdAt: new Date().toISOString(), note: 'Sao lưu CompetencyAI — không chứa mật khẩu và token' },
    permissions: await p.permission.findMany(),
    roles: await p.role.findMany({ include: { rolePermissions: true } }),
    users: await p.user.findMany({
      select: { id: true, email: true, name: true, status: true, employeeId: true, mustChangePassword: true, createdAt: true,
        userRoles: true, scopes: true },
    }),
    orgUnits: await p.orgUnit.findMany(),
    employees: await p.employee.findMany(),
    employeeAssignments: await p.employeeAssignment.findMany(),
    competencyCategories: await p.competencyCategory.findMany(),
    proficiencyScales: await p.proficiencyScale.findMany({ include: { levels: true } }),
    competencies: await p.competency.findMany(),
    competencyVersions: await p.competencyVersion.findMany(),
    jobFamilies: await p.jobFamily.findMany(),
    jobLevels: await p.jobLevel.findMany(),
    jobRoles: await p.jobRole.findMany({ include: { requirements: true } }),
    assessmentCampaigns: await p.assessmentCampaign.findMany(),
    assessmentParticipants: await p.assessmentParticipant.findMany(),
    assessmentRaters: await p.assessmentRater.findMany(),
    assessmentScores: await p.assessmentScore.findMany(),
    talentReviews: await p.talentReview.findMany(),
    idpPlans: await p.idpPlan.findMany({ include: { goals: { include: { actions: true } }, checkIns: true } }),
    successionPlans: await p.successionPlan.findMany({ include: { candidates: true } }),
    auditLogs: await p.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 20000 }),
  };
  const dir = resolve(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const file = resolve(dir, `competencyai-${stamp}.json`);
  writeFileSync(file, JSON.stringify(data, null, 1));
  const counts = Object.fromEntries(Object.entries(data).filter(([k]) => k !== '_meta').map(([k, v]) => [k, (v as unknown[]).length]));
  console.log('✔ Đã sao lưu:', file);
  console.log(counts);
}

main()
  .catch((e) => { console.error('✖', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
