import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Papa from 'papaparse';
import { prisma } from './db.js';

/**
 * Nạp Job Architecture: 14 Job Family · 6 Job Level · 26 Job Role · yêu cầu năng lực.
 *
 * VẤN ĐỀ ĐÃ PHÁT HIỆN: ma trận Vai trò×NL trong Sổ tay dùng bộ mã CŨ (VAL01, COR02, LEA03…)
 * và tên chuyên môn tự do ("Thẩm định đầu tư"), trong khi Từ điển dùng mã MỚI (CO1, LE2, FU03…).
 * → 0/58 mã khớp. Script này đối chiếu qua file data/doi_chieu_ma_nang_luc.csv.
 *
 * Quy tắc:
 *   - Dòng đối chiếu có trang_thai = DA_DUYET  → mappingStatus = APPROVED
 *   - Dòng có mã từ điển nhưng chưa duyệt       → PROPOSED (hiện nhãn "đề xuất" trên giao diện)
 *   - Không có mã từ điển                       → UNMAPPED (giữ nguyên nhãn gốc, không bịa)
 *   - Vai trò đã được HR duyệt trên app KHÔNG bị ghi đè khi chạy lại.
 *
 * Dùng:  npm run seed:job-architecture
 */

type Seed = {
  jobFamilies: Array<{
    code: string; jobFunction?: string; name: { vi: string }; careerStream?: string;
    description?: string; valueStages?: string;
  }>;
  jobLevels: Array<{
    code: string; name: { vi: string }; grade?: string; careerLevel?: string;
    contribution?: string; scope?: string; requiredBand?: Record<string, string>;
  }>;
  jobRoles: Array<{
    code: string; title: { vi: string; en?: string }; jobFamily: string; jobLevel: string;
    careerStream?: string; requirements: Array<{ competency: string; requiredLevel: number }>;
  }>;
};

type CrossRow = {
  ma_so_tay: string; ma_tu_dien: string; do_tin_cay: string; trang_thai: string; ghi_chu: string;
};

async function main() {
  const seedPath = resolve(process.cwd(), process.argv[2] ?? './data/flamingo_seed_data.json');
  const crossPath = resolve(process.cwd(), process.argv[3] ?? './data/doi_chieu_ma_nang_luc.csv');
  const seed: Seed = JSON.parse(readFileSync(seedPath, 'utf-8'));

  const cross = new Map<string, CrossRow>();
  if (existsSync(crossPath)) {
    const text = readFileSync(crossPath, 'utf-8').replace(/^﻿/, '');
    const parsed = Papa.parse<CrossRow>(text, { header: true, skipEmptyLines: true });
    for (const r of parsed.data) cross.set(r.ma_so_tay.trim(), r);
    console.log(`▸ Bảng đối chiếu: ${cross.size} dòng (${crossPath})`);
  } else {
    console.warn('⚠ Không thấy bảng đối chiếu — mọi yêu cầu sẽ là UNMAPPED');
  }

  const compByCode = new Map(
    (await prisma.competency.findMany({ select: { id: true, code: true } })).map((c) => [c.code, c.id]),
  );
  if (compByCode.size === 0) {
    console.error('✖ Chưa có năng lực trong CSDL. Chạy `npm run seed:competencies` trước.');
    process.exit(1);
  }

  console.log('▸ Job Family...');
  const famId = new Map<string, string>();
  for (const f of seed.jobFamilies) {
    const data = {
      name: f.name.vi, jobFunction: f.jobFunction ?? null, careerStream: f.careerStream ?? null,
      description: f.description ?? null, valueStages: f.valueStages ?? null,
    };
    const row = await prisma.jobFamily.upsert({ where: { code: f.code }, create: { code: f.code, ...data }, update: data });
    famId.set(f.code, row.id);
  }

  console.log('▸ Job Level...');
  const lvlId = new Map<string, string>();
  for (const l of seed.jobLevels) {
    const data = {
      name: l.name.vi, grade: l.grade ?? null, careerLevel: l.careerLevel ?? null,
      contribution: l.contribution ?? null, scope: l.scope ?? null,
      requiredBand: (l.requiredBand ?? null) as never, displayOrder: Number(l.code.replace(/\D/g, '')) || 0,
    };
    const row = await prisma.jobLevel.upsert({ where: { code: l.code }, create: { code: l.code, ...data }, update: data });
    lvlId.set(l.code, row.id);
  }

  console.log('▸ Job Role & yêu cầu năng lực...');
  const stat = { APPROVED: 0, PROPOSED: 0, UNMAPPED: 0, giuNguyen: 0 };
  for (const r of seed.jobRoles) {
    const data = {
      title: r.title.vi, titleEn: r.title.en ?? null, careerStream: r.careerStream ?? null,
      jobFamilyId: famId.get(r.jobFamily) ?? null, jobLevelId: lvlId.get(r.jobLevel) ?? null,
    };
    const role = await prisma.jobRole.upsert({ where: { code: r.code }, create: { code: r.code, ...data }, update: data });

    // Vai trò đã được HR duyệt trên app (PUT /job-roles/:code/requirements) → giữ nguyên toàn bộ
    const approvedInApp = await prisma.jobRoleRequirement.count({
      where: { jobRoleId: role.id, mappingStatus: 'APPROVED', note: { startsWith: 'Duyệt trên app bởi' } },
    });
    if (approvedInApp > 0) { stat.giuNguyen += approvedInApp; continue; }

    for (const q of r.requirements) {
      // Dòng đối chiếu đã được HR duyệt trên Bàn duyệt (POST /review/crosswalk/approve) → giữ nguyên
      const existing = await prisma.jobRoleRequirement.findUnique({
        where: { jobRoleId_sourceLabel: { jobRoleId: role.id, sourceLabel: q.competency } },
      });
      if (existing?.note?.startsWith('Duyệt đối chiếu trên app')) { stat.giuNguyen++; continue; }

      const x = cross.get(q.competency);
      const target = x?.ma_tu_dien ? compByCode.get(x.ma_tu_dien.trim()) : undefined;
      const status = !target ? 'UNMAPPED' : x!.trang_thai.trim() === 'DA_DUYET' ? 'APPROVED' : 'PROPOSED';
      stat[status as 'APPROVED' | 'PROPOSED' | 'UNMAPPED']++;

      const reqData = {
        competencyId: target ?? null,
        requiredLevel: q.requiredLevel,
        mappingStatus: status,
        mappingConfidence: x?.do_tin_cay ?? null,
        note: x?.ghi_chu || null,
      };
      await prisma.jobRoleRequirement.upsert({
        where: { jobRoleId_sourceLabel: { jobRoleId: role.id, sourceLabel: q.competency } },
        create: { jobRoleId: role.id, sourceLabel: q.competency, ...reqData },
        update: reqData,
      });
    }
  }

  console.log('\n▸ Kết quả:');
  console.log(`  Job Family: ${famId.size} · Job Level: ${lvlId.size} · Job Role: ${seed.jobRoles.length}`);
  console.log(`  Yêu cầu năng lực: đã duyệt ${stat.APPROVED} · đề xuất ${stat.PROPOSED} · chưa đối chiếu ${stat.UNMAPPED}` +
    (stat.giuNguyen ? ` · giữ nguyên (đã duyệt trên app) ${stat.giuNguyen}` : ''));
  if (stat.PROPOSED + stat.UNMAPPED > 0) {
    console.log('\n⚠ Các yêu cầu PROPOSED/UNMAPPED cần Ban NS&QTHC duyệt — xem 4-tai-lieu/QUYET_DINH_HOAN_THIEN.md (QĐ-02).');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
