import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from './db.js';

/**
 * Nạp từ điển năng lực từ flamingo_seed_data.json vào cơ sở dữ liệu.
 * Idempotent — chạy lại không nhân bản.
 *
 * Dùng:  npm run seed:competencies -- ./data/flamingo_seed_data.json
 */

type Level = { level: number; label: { vi: string; en?: string }; desc?: { vi: string } };
type Indicator = { level: number; indicator: string };
type Comp = {
  code: string;
  category: string;
  name: { vi: string; en?: string };
  definition?: { vi?: string };
  derivedFrom?: string;
  domainName?: string;
  owningUnit?: string;
  hasOwner?: boolean;
  dataGap?: string;
  referenceLevel?: number;
  behavioralIndicators?: Indicator[];
  positiveIndicators?: string[];
  negativeIndicators?: string[];
  overuseWarning?: string;
  scored?: boolean;
  /** Năng lực mới chưa được duyệt (vd CO7–CO9 theo QĐ-01) → chỉ tạo bản nháp, không ban hành */
  draft?: boolean;
};
type Seed = {
  proficiencyScale: { code: string; name: { vi: string }; levelCount: number; levels: Level[] };
  competencyCategories: Array<{ code: string; name: { vi: string }; scored: boolean; note?: string }>;
  competencies: Comp[];
  interviewQuestions?: Array<{ competencyCode: string; question: string; isCounterEvidence: boolean }>;
  dataWarnings?: Array<{ severity: string; area: string; issue: string; action: string }>;
};

async function main() {
  const path = process.argv[2] ?? './data/flamingo_seed_data.json';
  const full = resolve(process.cwd(), path);
  console.log('▸ Đọc file:', full);

  let seed: Seed;
  try {
    seed = JSON.parse(readFileSync(full, 'utf-8'));
  } catch (e) {
    console.error('✖ Không đọc được file. Kiểm tra đường dẫn.\n', (e as Error).message);
    process.exit(1);
  }

  // ---------- 1. Thang thành thục ----------
  console.log('▸ Nạp thang thành thục...');
  const scale = await prisma.proficiencyScale.upsert({
    where: { code: seed.proficiencyScale.code },
    create: {
      code: seed.proficiencyScale.code,
      name: seed.proficiencyScale.name.vi,
      levelCount: seed.proficiencyScale.levelCount,
      isDefault: true,
    },
    update: { name: seed.proficiencyScale.name.vi, levelCount: seed.proficiencyScale.levelCount },
  });

  for (const lv of seed.proficiencyScale.levels) {
    await prisma.proficiencyLevel.upsert({
      where: { scaleId_levelNumber: { scaleId: scale.id, levelNumber: lv.level } },
      create: {
        scaleId: scale.id,
        levelNumber: lv.level,
        label: lv.label.vi,
        description: lv.desc?.vi ?? null,
      },
      update: { label: lv.label.vi, description: lv.desc?.vi ?? null },
    });
  }

  // ---------- 2. Nhóm năng lực ----------
  console.log('▸ Nạp nhóm năng lực...');
  const catByCode = new Map<string, string>();
  let order = 0;
  for (const c of seed.competencyCategories) {
    const cat = await prisma.competencyCategory.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        name: c.name.vi,
        scored: c.scored,
        note: c.note ?? null,
        displayOrder: order++,
      },
      update: { name: c.name.vi, scored: c.scored, note: c.note ?? null },
    });
    catByCode.set(c.code, cat.id);
  }

  // ---------- 3. Năng lực + phiên bản đầu tiên ----------
  console.log('▸ Nạp năng lực...');
  const questionsByComp = new Map<string, Array<{ question: string; isCounterEvidence: boolean }>>();
  for (const q of seed.interviewQuestions ?? []) {
    const arr = questionsByComp.get(q.competencyCode) ?? [];
    arr.push({ question: q.question, isCounterEvidence: q.isCounterEvidence });
    questionsByComp.set(q.competencyCode, arr);
  }

  let created = 0;
  let updated = 0;
  let published = 0;
  let drafts = 0;
  let noOwner = 0;
  let partialLevels = 0;

  for (const c of seed.competencies) {
    const categoryId = catByCode.get(c.category);
    if (!categoryId) {
      console.warn(`  ⚠ Bỏ qua ${c.code}: nhóm "${c.category}" không tồn tại`);
      continue;
    }

    const before = await prisma.competency.findUnique({ where: { code: c.code } });
    // Đơn vị chủ quản đã được gán trên app (có nhật ký OWNER) → KHÔNG ghi đè bằng file
    const ownerSetInApp = before
      ? (await prisma.auditLog.count({
          where: { entityType: 'Competency', entityId: before.id, entityName: { startsWith: 'OWNER:' } },
        })) > 0
      : false;
    const ownerFields = ownerSetInApp
      ? {}
      : { owningUnit: c.owningUnit ?? null, hasOwner: c.hasOwner ?? true };

    const comp = await prisma.competency.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        name: c.name.vi,
        nameEn: c.name.en ?? null,
        definition: c.definition?.vi ?? null,
        derivedFrom: c.derivedFrom ?? null,
        domainName: c.domainName ?? null,
        owningUnit: c.owningUnit ?? null,
        hasOwner: c.hasOwner ?? true,
        dataGap: c.dataGap ?? null,
        categoryId,
        // Giá trị cốt lõi KHÔNG chấm điểm → không gắn thang
        scaleId: c.scored === false ? null : scale.id,
      },
      update: {
        name: c.name.vi,
        nameEn: c.name.en ?? null,
        definition: c.definition?.vi ?? null,
        derivedFrom: c.derivedFrom ?? null,
        domainName: c.domainName ?? null,
        ...ownerFields,
        dataGap: c.dataGap ?? null,
        categoryId,
        scaleId: c.scored === false ? null : scale.id,
      },
    });

    if (before) updated++; else created++;
    if (c.hasOwner === false) noOwner++;

    const inds = c.behavioralIndicators ?? [];
    if (inds.length > 0 && inds.length < 5) partialLevels++;

    // Tạo phiên bản 1 nếu chưa có phiên bản nào
    const existingVersion = await prisma.competencyVersion.findFirst({
      where: { competencyId: comp.id },
    });
    if (!existingVersion) {
      const version = await prisma.competencyVersion.create({
        data: {
          competencyId: comp.id,
          version: 1,
          status: c.draft ? 'DRAFT' : 'PUBLISHED',
          title: c.name.vi,
          definition: c.definition?.vi ?? c.name.vi,
          publishedAt: c.draft ? null : new Date(),
          levels: {
            behavioralIndicators: inds,
            positiveIndicators: c.positiveIndicators ?? [],
            negativeIndicators: c.negativeIndicators ?? [],
            overuseWarning: c.overuseWarning ?? null,
            interviewQuestions: questionsByComp.get(c.code) ?? [],
            referenceLevel: c.referenceLevel ?? null,
            // Nhãn dự thảo AI (CO7–CO9) = chưa đủ, dù có đủ 5 ô chữ
            completeness: inds.some((b) => /\[DỰ THẢO/i.test(b.indicator))
              ? 'AI_DRAFT'
              : inds.length === 5 ? 'FULL' : inds.length > 0 ? 'PARTIAL' : 'NONE',
          } as never,
        },
      });
      if (c.draft) {
        drafts++;
      } else {
        // Cập nhật con trỏ phiên bản hiện hành — đúng nguyên tắc versioning
        await prisma.competency.update({
          where: { id: comp.id },
          data: { currentVersionId: version.id },
        });
        published++;
      }
    }
  }

  // ---------- 4. Báo cáo ----------
  const totals = {
    thangThanhThuc: await prisma.proficiencyLevel.count({ where: { scaleId: scale.id } }),
    nhomNangLuc: await prisma.competencyCategory.count(),
    nangLuc: await prisma.competency.count(),
    phienBan: await prisma.competencyVersion.count(),
  };

  console.log('\n▸ Kết quả:');
  console.log('  Tạo mới:', created, '· Cập nhật:', updated, '· Phiên bản xuất bản:', published, '· Bản nháp (chờ duyệt):', drafts);
  console.log('  Tổng trong CSDL:', totals);

  if (noOwner > 0 || partialLevels > 0) {
    console.log('\n⚠ CẢNH BÁO DỮ LIỆU:');
    if (noOwner > 0) {
      const list = await prisma.competency.findMany({
        where: { hasOwner: false },
        select: { code: true, name: true },
      });
      console.log(`  • ${noOwner} năng lực CHƯA CÓ đơn vị chủ quản:`);
      for (const c of list) console.log(`      ${c.code} — ${c.name}`);
      console.log('    → Không ai chịu trách nhiệm tuyển dụng, đào tạo, đánh giá các năng lực này.');
    }
    if (partialLevels > 0) {
      console.log(`  • ${partialLevels} năng lực chỉ có MỘT PHẦN chỉ báo hành vi (thiếu mức 1,2,4,5).`);
      console.log('    → Chưa dựng được phiếu đánh giá đầy đủ. Cần workshop chuyên gia nghiệp vụ.');
    }
  }

  for (const w of seed.dataWarnings ?? []) {
    if (w.severity === 'HIGH') console.log(`\n⚠ [${w.severity}] ${w.area}: ${w.issue}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
