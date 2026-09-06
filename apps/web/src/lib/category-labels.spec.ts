import { describe, it, expect } from "vitest";
import { CATEGORY_LABELS } from "./category-labels";

describe("CATEGORY_LABELS", () => {
  it("only contains the real backend taxonomy", () => {
    expect(CATEGORY_LABELS).toEqual({ cafe: "Kahve", restaurant: "Restoran", bakery: "Fırın", "street-food": "Sokak lezzeti" });
  });
});
