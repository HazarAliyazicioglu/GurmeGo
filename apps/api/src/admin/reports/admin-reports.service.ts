import { Injectable } from "@nestjs/common";
import { VenueSource } from "@prisma/client";
import { stringify } from "csv-stringify/sync";
import { PrismaService } from "../../prisma/prisma.service";
import { getStaleDays } from "../../common/rule-config";

type DistrictGroupResult = {
  districtId: string;
  _count: number;
};

type SourceGroupResult = {
  source: VenueSource;
  _count: number;
};

// OWASP CSV/Formula Injection mitigation: a curator-approved contribution can carry a free-text
// Venue field (name, editorialNote, transportNote, address, cuisineType) starting with a character
// a spreadsheet app interprets as a formula prefix -- opening the exported CSV in Excel/Sheets
// would execute it automatically. Only string fields need this: array/object fields (signatureItems,
// photos, openingHours) are JSON-stringified by `csv-stringify` into a cell starting with `[`/`{`,
// which is never treated as a formula. JSON export is untouched -- it's never opened by a
// spreadsheet app, so there's nothing to mitigate there.
// Leading tab/CR/LF are included alongside the four OWASP-canonical characters: some spreadsheet
// import paths skip leading whitespace/control characters before formula-prefix detection, so a
// value like "\t=cmd(...)" can still be interpreted as a formula despite not visibly starting with
// one of the four base characters.
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r\n]/;
function escapeCsvFormulaInjection(value: unknown): unknown {
  return typeof value === "string" && CSV_FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

@Injectable()
export class AdminReportsService {
  constructor(private prisma: PrismaService) {}

  async dataQuality() {
    const staleDays = getStaleDays();
    const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

    const [byDistrict, districts, staleCount, bySourceRaw] = await Promise.all([
      this.prisma.venue.groupBy({ by: ["districtId"], _count: true }),
      this.prisma.district.findMany(),
      this.prisma.venue.count({ where: { verifiedAt: { lt: cutoff } } }),
      this.prisma.venue.groupBy({ by: ["source"], _count: true }),
    ]);

    const districtMap = new Map(districts.map((d) => [d.id, d.name]));
    return {
      perDistrict: byDistrict.map((row: DistrictGroupResult) => ({ name: districtMap.get(row.districtId), count: row._count })),
      staleCount,
      bySource: bySourceRaw.map((row: SourceGroupResult) => ({ source: row.source, count: row._count })),
    };
  }

  async exportVenues(format: "json" | "csv"): Promise<string> {
    const venues = await this.prisma.venue.findMany({ where: { status: "PUBLISHED" } });
    if (format === "json") return JSON.stringify(venues);
    const rows = venues.map((venue) =>
      Object.fromEntries(Object.entries(venue).map(([key, value]) => [key, escapeCsvFormulaInjection(value)])),
    );
    return stringify(rows, { header: true });
  }
}
