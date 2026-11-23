import { JobRoleRequirement } from '../../packages/db/src/types';
import { COMPETENCY_CROSSWALK } from './competencyCrosswalk';

export type RawRequirement = {
  sourceLabel: string;
  competency: string | null; // mã Từ điển nếu đã đối chiếu
  requiredLevel: number;
  mappingStatus: 'APPROVED' | 'PROPOSED' | 'UNMAPPED';
  mappingConfidence?: string | null;
  note?: string | null;
};

/** Áp bảng đối chiếu cho yêu cầu dạng Sổ tay (chế độ Demo). */
export function mapLegacyRequirement(label: string, requiredLevel: number): RawRequirement {
  const x = COMPETENCY_CROSSWALK[label];
  if (!x || !x.code) {
    return { sourceLabel: label, competency: null, requiredLevel, mappingStatus: 'UNMAPPED', mappingConfidence: x?.confidence ?? null, note: x?.note ?? null };
  }
  return {
    sourceLabel: label,
    competency: x.code,
    requiredLevel,
    mappingStatus: x.status === 'DA_DUYET' ? 'APPROVED' : 'PROPOSED',
    mappingConfidence: x.confidence,
    note: x.note || null,
  };
}

/**
 * Gộp các yêu cầu trỏ về CÙNG một năng lực (vd VAL01·5 và COR07·4 cùng → CO1):
 * giữ mức yêu cầu CAO NHẤT, ghi lại toàn bộ nhãn gốc để truy vết.
 * Yêu cầu chưa đối chiếu được giữ nguyên nhãn gốc (không bịa mã).
 */
export function consolidateRequirements(raw: RawRequirement[]): JobRoleRequirement[] {
  const byKey = new Map<string, JobRoleRequirement>();
  const rank = { UNMAPPED: 0, PROPOSED: 1, APPROVED: 2 } as const;
  for (const r of raw) {
    const key = r.competency ?? r.sourceLabel;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, {
        competency: key,
        requiredLevel: r.requiredLevel,
        sourceCodes: [r.sourceLabel],
        mappingStatus: r.mappingStatus,
        mappingConfidence: r.mappingConfidence ?? null,
      });
      continue;
    }
    prev.requiredLevel = Math.max(prev.requiredLevel, r.requiredLevel);
    prev.sourceCodes = [...(prev.sourceCodes ?? []), r.sourceLabel];
    // trạng thái gộp = trạng thái YẾU nhất (một nguồn chưa duyệt thì cả dòng chưa duyệt)
    if (prev.mappingStatus && rank[r.mappingStatus] < rank[prev.mappingStatus]) prev.mappingStatus = r.mappingStatus;
  }
  return [...byKey.values()];
}
