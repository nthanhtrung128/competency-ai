import { describe, it, expect } from 'vitest';
import { mapBootstrap, anchorsToIndicators, mapAuditLogs, feCompId, feVersionId, feOrgId, BootstrapPayload } from '../src/api/serverAdapter';

const payload = (): BootstrapPayload => ({
  serverTime: '2026-11-23T00:00:00Z',
  me: { id: 'u1', email: 'a@test.invalid', name: 'A', roles: [], permissions: [], scope: 'TOAN_BO' },
  proficiencyScale: {
    id: 's1', code: 'FLA-5', name: 'Thang FLA-5', levelCount: 5,
    levels: [1, 2, 3, 4, 5].map((n) => ({ levelNumber: n, label: `L${n}`, description: `mô tả ${n}` })),
  },
  categories: [{ id: 'c1', code: 'FUN', name: 'Chuyên môn', scored: true, note: null, displayOrder: 1 }],
  competencies: [{
    id: 'comp-uuid', code: 'FU03', name: 'Năng lực A', nameEn: 'A', definition: 'Định nghĩa', derivedFrom: null,
    domainName: null, owningUnit: null, hasOwner: false, dataGap: null, categoryCode: 'FUN', scaleId: 's1',
    currentVersionId: 'v2-uuid',
    versions: [
      { id: 'v1-uuid', version: 1, status: 'ARCHIVED', title: 't1', definition: 'd1', levels: null, publishedAt: null, archivedAt: null, createdAt: '2026-01-01T00:00:00Z' },
      {
        id: 'v2-uuid', version: 2, status: 'PUBLISHED', title: 't2', definition: 'd2', publishedAt: '2026-02-01T00:00:00Z', archivedAt: null,
        createdAt: '2026-02-01T00:00:00Z',
        levels: {
          behavioralIndicators: [{ level: 1, indicator: 'chỉ báo 1' }, { level: 3, indicator: 'chỉ báo 3' }],
          positiveIndicators: ['p'], referenceLevel: 3,
          interviewQuestions: [{ question: 'q?', isCounterEvidence: false }], changeNote: 'ghi chú',
        },
      },
    ],
  }],
  orgUnits: [
    { id: 'o-root', code: 'TD', name: 'Tập đoàn', nameEn: null, type: 'GROUP', tier: 0, parentId: null, parentCode: null, note: null, headDisplay: '', employeeCount: 0 },
    { id: 'o-b01', code: 'B01', name: 'Ban 1', nameEn: 'B1', type: 'DEPARTMENT', tier: 1, parentId: 'o-root', parentCode: 'TD', note: '[GAP] chưa có breakdown', headDisplay: 'X', employeeCount: 3 },
    { id: 'o-x', code: 'X1', name: 'Ngoài phạm vi', nameEn: null, type: 'UNKNOWN_TYPE', tier: 2, parentId: 'o-hidden', parentCode: 'H', note: null, headDisplay: '', employeeCount: 0 },
  ],
  jobFamilies: [{ id: 'jf', code: 'JF1', name: 'Fam', jobFunction: null, careerStream: null, description: null, valueStages: null }],
  jobLevels: [{ code: 'L1', name: 'Cấp 1', grade: null, careerLevel: null, contribution: null, scope: null, requiredBand: null }],
  jobRoles: [{ code: 'R1', title: 'Vai trò', titleEn: null, careerStream: null, jobFamily: null, jobLevel: null, requirements: [] }],
});

describe('mapBootstrap', () => {
  const ds = mapBootstrap(payload());

  it('giữ quy ước id phía giao diện và lưu uuid thật trong serverIds', () => {
    expect(feCompId('FU03')).toBe('comp-fu03');
    expect(feVersionId('FU03', 2)).toBe('ver-fu03-v2');
    expect(feOrgId('B01')).toBe('org-b01');
    expect(ds.serverIds.competency['comp-fu03']).toBe('comp-uuid');
    expect(ds.serverIds.version['ver-fu03-v2']).toBe('v2-uuid');
    expect(ds.serverIds.orgUnit['org-b01']).toBe('o-b01');
    expect(ds.serverIds.orgTier['org-b01']).toBe(1);
  });

  it('tạo thang gốc + 5 mức con', () => {
    expect(ds.proficiencyScales).toHaveLength(6);
    expect(ds.proficiencyScales.filter((s) => s.parentId === 'scale-fla-5')).toHaveLength(5);
  });

  it('thiếu thang → không có scale, năng lực không chấm điểm', () => {
    const p = payload();
    p.proficiencyScale = null;
    p.competencies[0].scaleId = null;
    const d = mapBootstrap(p);
    expect(d.proficiencyScales).toHaveLength(0);
    expect(d.competencies[0].scored).toBe(false);
    expect(d.competencies[0].scaleId).toBeNull();
  });

  it('năng lực trỏ về phiên bản hiện hành, lấy chỉ báo/câu hỏi từ phiên bản đó', () => {
    const c = ds.competencies[0];
    expect(c.currentVersionId).toBe('ver-fu03-v2');
    expect(c.referenceLevel).toBe(3);
    expect(c.positiveIndicators).toEqual(['p']);
    expect(ds.interviewQuestions).toEqual([{ competencyCode: 'FU03', question: 'q?', isCounterEvidence: false }]);
  });

  it('mức chưa có chỉ báo ghi rõ "chưa có", không điền câu chung chung', () => {
    const v2 = ds.versions.find((v) => v.id === 'ver-fu03-v2')!;
    expect(v2.level1Anchor).toBe('chỉ báo 1');
    expect(v2.level2Anchor).toMatch(/^\[Mức 2 chưa có chỉ báo/);
    expect(v2.level4Anchor).toMatch(/^\[Mức 4 chưa có chỉ báo/);
    const v1 = ds.versions.find((v) => v.id === 'ver-fu03-v1')!; // levels = null
    expect(v1.level5Anchor).toMatch(/^\[Mức 5 chưa có chỉ báo/);
    expect(v2.changeLog).toBe('ghi chú');
  });

  it('đơn vị: cha trong phạm vi được nối, cha ngoài phạm vi thành gốc cây con', () => {
    const b01 = ds.orgUnits.find((u) => u.id === 'org-b01')!;
    expect(b01.parentId).toBe('org-td');
    expect(b01.path).toBe('/TD/B01');
    expect(b01.level).toBe(2);
    expect((b01.metadata as { isGap: boolean }).isGap).toBe(true);
    const x = ds.orgUnits.find((u) => u.id === 'org-x1')!;
    expect(x.parentId).toBeNull();
    expect(x.type).toBe('DEPARTMENT'); // loại lạ → mặc định
  });

  it('Job Architecture: trường null → chuỗi rỗng', () => {
    expect(ds.jobLevels[0].requiredBand).toEqual({ core: '', leadership: '', functional: '' });
    expect(ds.jobRoles[0].jobFamily).toBe('');
    expect(ds.jobFamilies[0].id).toBe('jf-jf1');
  });
});

describe('anchorsToIndicators', () => {
  it('bỏ ô giữ chỗ "[Mức n chưa có…]" và ô trống', () => {
    const out = anchorsToIndicators({
      level1Anchor: ' ok ', level2Anchor: '[Mức 2 chưa có chỉ báo — cần chuyên gia nghiệp vụ viết]',
      level3Anchor: '', level4Anchor: 'x', level5Anchor: undefined,
    });
    expect(out).toEqual([{ level: 1, indicator: 'ok' }, { level: 4, indicator: 'x' }]);
  });
});

describe('mapAuditLogs', () => {
  it('hành động lạ → UPDATE; giữ nguyên hành động hợp lệ; null hoá giá trị thiếu', () => {
    const base = { id: '1', entityType: 'X', entityId: 'e', entityName: null, actorId: null, actorEmail: null, oldValues: undefined, newValues: { a: 1 }, timestamp: '2026-11-23T00:00:00Z' };
    const [a, b] = mapAuditLogs([{ ...base, action: 'PUBLISH' }, { ...base, id: '2', action: 'WEIRD' }]);
    expect(a.action).toBe('PUBLISH');
    expect(b.action).toBe('UPDATE');
    expect(a.oldValues).toBeNull();
    expect(a.timestamp).toBeInstanceOf(Date);
  });
});
