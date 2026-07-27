import { Injectable } from "@nestjs/common";
import { getBoutiqueMaxBranches } from "../common/rule-config";

interface BoutiqueInput {
  branchCount: number;
  franchiseFlag: boolean;
  hasEditorialNote: boolean;
  status: string;
}

@Injectable()
export class BoutiqueService {
  evaluate({ branchCount, franchiseFlag, hasEditorialNote, status }: BoutiqueInput): boolean {
    if (status !== "PUBLISHED") return false;
    const maxBranches = getBoutiqueMaxBranches();
    return branchCount <= maxBranches && !franchiseFlag && hasEditorialNote;
  }
}
