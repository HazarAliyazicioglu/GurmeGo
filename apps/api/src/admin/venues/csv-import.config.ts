import { parsePositiveIntEnv } from "../../common/env.util";

// docs/DENETIM-RAPORU.md Orta: the 10 MB upload limit bounds bytes, not rows -- tens of thousands of short
// rows fit in it, and each valid row costs 2-3 sequential DB queries. Rows beyond this are rejected up front.
export const CSV_IMPORT_LIMITS = {
  maxRows: parsePositiveIntEnv("CSV_IMPORT_MAX_ROWS", process.env.CSV_IMPORT_MAX_ROWS, 2000),
};
