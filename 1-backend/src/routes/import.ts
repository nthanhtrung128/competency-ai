import { Router } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import { z } from 'zod';
import { currentWorkspace, prisma } from '../db.js';
import { authenticate, requirePermission, audit } from '../auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

export const importRouter = Router();

// ---------------------------------------------------------------- kiểu dữ liệu

const RowSchema = z.object({
  employee_code: z.string().trim().min(1, 'Thiếu mã nhân viên'),
  full_name: z.string().trim().min(1, 'Thiếu họ tên'),
  email: z.string().trim().email('Email không hợp lệ').optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  org_unit_code: z.string().trim().min(1, 'Thiếu mã đơn vị'),
  job_title: z.string().trim().optional().or(z.literal('')),
  job_role_code: z.string().trim().optional().or(z.literal('')),
  job_level_code: z.string().trim().optional().or(z.literal('')),
  grade_code: z.string().trim().optional().or(z.literal('')),
  manager_code: z.string().trim().optional().or(z.literal('')),
  hire_date: z.string().trim().optional().or(z.literal('')),
  status: z.string().trim().optional().or(z.literal('')),
});

type RowMsg = { level: 'ERROR' | 'WARNING'; text: string };

const STATUS_MAP: Record<string, 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED'> = {
  '': 'ACTIVE',
  'dang lam viec': 'ACTIVE',
  'đang làm việc': 'ACTIVE',
  active: 'ACTIVE',
  'nghi phep': 'ON_LEAVE',
  'nghỉ phép': 'ON_LEAVE',
  'tam nghi': 'ON_LEAVE',
  on_leave: 'ON_LEAVE',
  'da nghi viec': 'TERMINATED',
  'đã nghỉ việc': 'TERMINATED',
  terminated: 'TERMINATED',
};

function parseDate(v: string): { value: Date | null; msg?: RowMsg } {
  if (!v) return { value: null };
  // chấp nhận dd/mm/yyyy và yyyy-mm-dd
  const dmy = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    if (!isNaN(d.getTime())) return { value: d };
  }
  const iso = new Date(v);
  if (!isNaN(iso.getTime())) return { value: iso };
  return {
    value: null,
    msg: { level: 'WARNING', text: `Không đọc được ngày "${v}" — bỏ trống. Dùng dd/mm/yyyy.` },
  };
}

// ---------------------------------------------------------------- BƯỚC 1: tải lên + kiểm tra

/**
 * POST /import/employees/validate
 * Tải file CSV lên, kiểm tra TOÀN BỘ, KHÔNG ghi vào bảng employees.
 * Trả về kết quả chạy thử để người dùng xem trước.
 */
importRouter.post(
  '/employees/validate',
  authenticate,
  requirePermission('employee:import'),
  upload.single('file'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Chưa chọn file' });

    const text = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, ''); // bỏ BOM của Excel
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return res.status(400).json({ error: 'Không đọc được file CSV', detail: parsed.errors[0] });
    }

    const batch = await prisma.importBatch.create({
      data: {
        fileName: req.file.originalname,
        entityType: 'EMPLOYEE',
        status: 'DRAFT',
        totalRows: parsed.data.length,
        uploadedById: req.user!.id,
      },
    });

    // nạp sẵn dữ liệu đối chiếu
    const [orgUnits, existing, jobRoles] = await Promise.all([
      prisma.orgUnit.findMany({ select: { id: true, code: true, name: true } }),
      prisma.employee.findMany({ select: { id: true, employeeCode: true, email: true } }),
      currentWorkspace() ? prisma.jobRole.findMany({ where: { isActive: true }, select: { code: true } }) : Promise.resolve([]),
    ]);
    const unitByCode = new Map(orgUnits.map((u) => [u.code.toUpperCase(), u]));
    const empByCode = new Map(existing.map((e) => [e.employeeCode.toUpperCase(), e]));
    const roleCodes = new Set(jobRoles.map(role => role.code));
    const emailOwner = new Map(existing.filter((e) => e.email).map((e) => [e.email!.toLowerCase(), e.employeeCode]));

    const seenCodes = new Set<string>();
    const allCodesInFile = new Set(
      parsed.data.map((r) => (r.employee_code ?? '').trim().toUpperCase()).filter(Boolean),
    );

    let ok = 0, warn = 0, err = 0;
    const rowsToCreate: Array<Parameters<typeof prisma.importRow.create>[0]['data']> = [];

    parsed.data.forEach((raw, i) => {
      const rowNumber = i + 2; // +1 header, +1 vì Excel đếm từ 1
      const messages: RowMsg[] = [];

      const check = RowSchema.safeParse(raw);
      if (!check.success) {
        for (const issue of check.error.issues) {
          messages.push({ level: 'ERROR', text: `${issue.path.join('.')}: ${issue.message}` });
        }
      }

      const code = (raw.employee_code ?? '').trim().toUpperCase();
      const unitCode = (raw.org_unit_code ?? '').trim().toUpperCase();
      const email = (raw.email ?? '').trim().toLowerCase();
      const managerCode = (raw.manager_code ?? '').trim().toUpperCase();
      const roleCode = (raw.job_role_code ?? '').trim();
      if (currentWorkspace() && roleCode && !roleCodes.has(roleCode.toUpperCase())) {
        messages.push({ level: 'ERROR', text: `Mã chức danh "${roleCode}" chưa có hoặc đã ngừng sử dụng. Tạo hồ sơ chức danh trước khi nhập.` });
      }

      // trùng mã trong chính file
      if (code && seenCodes.has(code)) {
        messages.push({ level: 'ERROR', text: `Mã nhân viên "${code}" bị lặp trong file` });
      }
      if (code) seenCodes.add(code);

      // đơn vị phải tồn tại
      const unit = unitCode ? unitByCode.get(unitCode) : undefined;
      if (unitCode && !unit) {
        messages.push({
          level: 'ERROR',
          text: `Mã đơn vị "${unitCode}" không có trong hệ thống. Tạo đơn vị trước khi nhập nhân sự.`,
        });
      }

      // email trùng người khác
      if (email && emailOwner.has(email) && emailOwner.get(email) !== code) {
        messages.push({
          level: 'ERROR',
          text: `Email "${email}" đã thuộc về nhân viên ${emailOwner.get(email)}`,
        });
      }

      // quản lý phải tồn tại (trong hệ thống hoặc trong chính file này)
      if (managerCode && !empByCode.has(managerCode) && !allCodesInFile.has(managerCode)) {
        messages.push({
          level: 'WARNING',
          text: `Mã quản lý "${managerCode}" chưa tồn tại — sẽ bỏ trống, cập nhật sau.`,
        });
      }
      if (managerCode && managerCode === code) {
        messages.push({ level: 'ERROR', text: 'Nhân viên không thể là quản lý của chính mình' });
      }

      const hire = parseDate((raw.hire_date ?? '').trim());
      if (hire.msg) messages.push(hire.msg);

      const rawStatus = (raw.status ?? '').trim().toLowerCase();
      const status = STATUS_MAP[rawStatus];
      if (rawStatus && !status) {
        messages.push({
          level: 'WARNING',
          text: `Trạng thái "${raw.status}" không nhận diện được — mặc định ACTIVE.`,
        });
      }

      const hasError = messages.some((m) => m.level === 'ERROR');
      const hasWarn = messages.some((m) => m.level === 'WARNING');
      const existingEmp = code ? empByCode.get(code) : undefined;

      const rowStatus = hasError ? 'ERROR' : hasWarn ? 'WARNING' : 'OK';
      const action = hasError ? 'SKIP' : existingEmp ? 'UPDATE' : 'CREATE';

      if (hasError) err++; else if (hasWarn) warn++; else ok++;

      rowsToCreate.push({
        batchId: batch.id,
        rowNumber,
        raw: raw as never,
        normalized: hasError
          ? undefined
          : ({
              employeeCode: code,
              fullName: (raw.full_name ?? '').trim(),
              email: email || null,
              phone: (raw.phone ?? '').trim() || null,
              orgUnitId: unit?.id ?? null,
              orgUnitCode: unitCode,
              jobTitle: (raw.job_title ?? '').trim() || null,
              jobRoleCode: (currentWorkspace() ? roleCode.toUpperCase() : roleCode) || null,
              jobLevelCode: (raw.job_level_code ?? '').trim() || null,
              gradeCode: (raw.grade_code ?? '').trim() || null,
              managerCode: managerCode || null,
              hireDate: hire.value ? hire.value.toISOString() : null,
              status: status ?? 'ACTIVE',
            } as never),
        status: rowStatus,
        messages: messages as never,
        action,
        employeeId: existingEmp?.id ?? null,
      });
    });

    // ghi vùng đệm theo lô để tránh quá nhiều truy vấn
    for (let i = 0; i < rowsToCreate.length; i += 500) {
      await prisma.importRow.createMany({ data: rowsToCreate.slice(i, i + 500) as never });
    }

    const updated = await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: 'VALIDATED',
        okRows: ok,
        warningRows: warn,
        errorRows: err,
        validatedAt: new Date(),
      },
    });

    await audit(req, 'IMPORT', 'ImportBatch', batch.id, {
      entityName: `Kiểm tra file ${req.file.originalname}`,
      newValues: { total: parsed.data.length, ok, warn, err },
    });

    res.json({
      batchId: updated.id,
      summary: {
        tong: updated.totalRows,
        hopLe: ok,
        canhBao: warn,
        loi: err,
        seTao: rowsToCreate.filter((r) => r.action === 'CREATE').length,
        seCapNhat: rowsToCreate.filter((r) => r.action === 'UPDATE').length,
      },
      message:
        err > 0
          ? `Có ${err} dòng lỗi. Sửa file rồi tải lại. CHƯA có gì được ghi vào hệ thống.`
          : `Kiểm tra xong, không có lỗi. Gọi /import/employees/${updated.id}/commit để ghi thật.`,
    });
  },
);

// ---------------------------------------------------------------- xem chi tiết

importRouter.get(
  '/employees/:batchId/rows',
  authenticate,
  requirePermission('employee:import'),
  async (req, res) => {
    const status = req.query.status as string | undefined;
    const rows = await prisma.importRow.findMany({
      where: {
        batchId: req.params.batchId,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { rowNumber: 'asc' },
      take: 500,
    });
    res.json({ count: rows.length, rows });
  },
);

// ---------------------------------------------------------------- BƯỚC 2: ghi thật

/**
 * POST /import/employees/:batchId/commit
 * Chỉ ghi các dòng KHÔNG lỗi. Chạy trong transaction — hỏng giữa chừng thì hoàn tác toàn bộ.
 */
importRouter.post(
  '/employees/:batchId/commit',
  authenticate,
  requirePermission('employee:import'),
  async (req, res) => {
    const batch = await prisma.importBatch.findUnique({ where: { id: req.params.batchId } });
    if (!batch) return res.status(404).json({ error: 'Không tìm thấy lô nhập' });
    if (batch.status === 'COMMITTED') {
      return res.status(409).json({ error: 'Lô này đã được ghi rồi, không ghi lại lần hai' });
    }
    if (batch.status !== 'VALIDATED') {
      return res.status(400).json({ error: 'Phải chạy /validate trước' });
    }

    const rows = await prisma.importRow.findMany({
      where: { batchId: batch.id, status: { in: ['OK', 'WARNING'] } },
      orderBy: { rowNumber: 'asc' },
    });

    let created = 0;
    let updatedCount = 0;

    const committed = await prisma.$transaction(async (tx) => {
      // Claim the validated batch atomically. Rollback also releases the claim.
      const claim = await tx.importBatch.updateMany({
        where: { id: batch.id, status: 'VALIDATED' }, data: { status: 'COMMITTED' },
      });
      if (!claim.count) return false;
      // vòng 1: tạo/cập nhật nhân sự (chưa gán quản lý)
      for (const row of rows) {
        const n = row.normalized as Record<string, string | null>;
        if (!n) continue;

        const data = {
          fullName: n.fullName as string,
          email: n.email,
          phone: n.phone,
          orgUnitId: n.orgUnitId,
          jobTitle: n.jobTitle,
          jobRoleCode: n.jobRoleCode,
          jobLevelCode: n.jobLevelCode,
          gradeCode: n.gradeCode,
          hireDate: n.hireDate ? new Date(n.hireDate) : null,
          status: (n.status ?? 'ACTIVE') as never,
        };

        const emp = await tx.employee.upsert({
          where: { employeeCode: n.employeeCode as string },
          create: { employeeCode: n.employeeCode as string, ...data },
          update: data,
        });

        if (row.action === 'CREATE') created++;
        else updatedCount++;

        // lịch sử điều chuyển — chỉ thêm khi đơn vị thay đổi, KHÔNG ghi đè bản ghi cũ
        if (n.orgUnitId) {
          const last = await tx.employeeAssignment.findFirst({
            where: { employeeId: emp.id, effectiveTo: null },
            orderBy: { effectiveFrom: 'desc' },
          });
          if (!last || last.orgUnitId !== n.orgUnitId) {
            if (last) {
              await tx.employeeAssignment.update({
                where: { id: last.id },
                data: { effectiveTo: new Date() },
              });
            }
            await tx.employeeAssignment.create({
              data: {
                employeeId: emp.id,
                orgUnitId: n.orgUnitId,
                jobTitle: n.jobTitle,
                jobRoleCode: n.jobRoleCode,
                effectiveFrom: n.hireDate ? new Date(n.hireDate) : new Date(),
                source: `IMPORT:${batch.id}`,
              },
            });
          }
        }

        await tx.importRow.update({ where: { id: row.id }, data: { employeeId: emp.id } });
      }

      // vòng 2: gán quản lý sau khi mọi người đã tồn tại
      for (const row of rows) {
        const n = row.normalized as Record<string, string | null>;
        if (!n?.managerCode) continue;
        const mgr = await tx.employee.findUnique({
          where: { employeeCode: n.managerCode },
          select: { id: true },
        });
        if (!mgr) continue;
        const me = await tx.employee.findUnique({
          where: { employeeCode: n.employeeCode as string },
          select: { id: true },
        });
        if (me && me.id !== mgr.id) {
          await tx.employee.update({ where: { id: me.id }, data: { managerId: mgr.id } });
        }
      }

      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          status: 'COMMITTED',
          committedAt: new Date(),
          createdRows: created,
          updatedRows: updatedCount,
        },
      });
      await tx.auditLog.create({ data: {
        action: 'IMPORT', entityType: 'ImportBatch', entityId: batch.id, entityName: `Ghi thật ${batch.fileName}`,
        actorId: req.user!.id, actorEmail: req.user!.email, newValues: { created, updated: updatedCount },
      } });
      return true;
    }, { timeout: 60000 });
    if (!committed) return res.status(409).json({ error: 'Lô nhập đã được xử lý.' });

    res.json({
      batchId: batch.id,
      daTao: created,
      daCapNhat: updatedCount,
      message: 'Đã ghi vào hệ thống. Xem nhật ký tại /audit-logs.',
    });
  },
);

// ---------------------------------------------------------------- huỷ lô

importRouter.post(
  '/employees/:batchId/cancel',
  authenticate,
  requirePermission('employee:import'),
  async (req, res) => {
    const batch = await prisma.importBatch.findUnique({ where: { id: req.params.batchId } });
    if (!batch) return res.status(404).json({ error: 'Không tìm thấy lô nhập' });
    if (batch.status === 'COMMITTED') {
      return res.status(409).json({ error: 'Lô đã ghi thật, không huỷ được' });
    }
    const change = await prisma.importBatch.updateMany({ where: { id: batch.id, status: { not: 'COMMITTED' } }, data: { status: 'CANCELLED' } });
    if (!change.count) return res.status(409).json({ error: 'Lô đã ghi thật, không huỷ được' });
    res.json({ message: 'Đã huỷ lô nhập. Dữ liệu vùng đệm được giữ để tra cứu.' });
  },
);
