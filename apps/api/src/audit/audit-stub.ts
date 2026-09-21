import type { AuditService } from "./audit.service";

// Unit specs that construct admin services directly do not care about the audit trail unless they assert
// on it; this records nothing. (Specs that DO assert use their own jest.fn() `record`.)
export const auditStub = () => ({ record: jest.fn().mockResolvedValue(undefined) }) as unknown as AuditService;
