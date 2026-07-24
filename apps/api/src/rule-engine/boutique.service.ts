import { Injectable } from "@nestjs/common";

interface BoutiqueInput {
  branchCount: number;
  franchiseFlag: boolean;
  hasEditorialNote: boolean;
}

@Injectable()
export class BoutiqueService {
  evaluate({ branchCount, franchiseFlag, hasEditorialNote }: BoutiqueInput): boolean {
    const maxBranches = Number(process.env.RULES_BOUTIQUE_MAX_BRANCHES ?? 3);
    return branchCount <= maxBranches && !franchiseFlag && hasEditorialNote;
  }
}
