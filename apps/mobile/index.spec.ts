const mockInitSentry = jest.fn();
jest.mock("./src/lib/sentry", () => ({ initSentry: () => mockInitSentry() }));

const mockRegisterRootComponent = jest.fn();
jest.mock("expo", () => ({ registerRootComponent: (...args: unknown[]) => mockRegisterRootComponent(...args) }));

const FakeApp = () => null;
jest.mock("./App", () => ({ default: FakeApp }));

// cross-model-review (2026-09-29) MAJOR finding: a static `import App from './App'` would be
// evaluated before initSentry() regardless of source order (Babel/Metro compiles ES imports to
// requires in written order, all before this file's own top-level statements run) -- a startup
// crash while requiring './App' would then never reach Sentry. This asserts the fix: initSentry()
// actually runs before './App' is required.
describe("index.ts bootstrap", () => {
  it("calls initSentry before requiring ./App", () => {
    const requireOrder: string[] = [];
    mockInitSentry.mockImplementation(() => requireOrder.push("initSentry"));
    jest.doMock("./App", () => {
      requireOrder.push("./App");
      return { default: FakeApp };
    });

    require("./index");

    expect(requireOrder).toEqual(["initSentry", "./App"]);
    expect(mockRegisterRootComponent).toHaveBeenCalledWith(FakeApp);
  });
});
