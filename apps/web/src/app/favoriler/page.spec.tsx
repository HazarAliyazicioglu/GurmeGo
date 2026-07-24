import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import FavorilerPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: null, loading: false, session: null }) }));

describe("FavorilerPage", () => {
  it("redirects to /giris when there is no authenticated user", () => {
    render(<FavorilerPage />);
    expect(push).toHaveBeenCalledWith("/giris");
  });
});
