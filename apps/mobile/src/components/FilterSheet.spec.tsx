import { render, screen, fireEvent } from "@testing-library/react-native";
import FilterSheet from "./FilterSheet";

const DISTRICTS = [{ id: "d1", cityId: "c1", name: "Kadıköy", slug: "kadikoy" }];

async function renderSheet(overrides: Partial<React.ComponentProps<typeof FilterSheet>> = {}) {
  const props = {
    visible: true,
    onClose: jest.fn(),
    districts: DISTRICTS,
    selectedDistrictId: undefined,
    onSelectDistrict: jest.fn(),
    selectedCategory: undefined,
    onSelectCategory: jest.fn(),
    selectedPriceRange: undefined,
    onSelectPriceRange: jest.fn(),
    ...overrides,
  };
  await render(<FilterSheet {...props} />);
  return props;
}

describe("FilterSheet", () => {
  it("is hidden when visible=false", async () => {
    await renderSheet({ visible: false });
    expect(screen.queryByText("Filtrele")).toBeFalsy();
  });

  it("calls onSelectDistrict when a district chip is pressed", async () => {
    const props = await renderSheet();

    await fireEvent.press(screen.getByText("Kadıköy"));

    expect(props.onSelectDistrict).toHaveBeenCalledWith("d1");
  });

  it("clears the district selection when the already-selected chip is pressed again", async () => {
    const props = await renderSheet({ selectedDistrictId: "d1" });

    await fireEvent.press(screen.getByText("Kadıköy"));

    expect(props.onSelectDistrict).toHaveBeenCalledWith(undefined);
  });

  it("calls onSelectCategory and onSelectPriceRange for their own chips", async () => {
    const props = await renderSheet();

    await fireEvent.press(screen.getByText("Kahve"));
    expect(props.onSelectCategory).toHaveBeenCalledWith("cafe");

    await fireEvent.press(screen.getByText("₺₺"));
    expect(props.onSelectPriceRange).toHaveBeenCalledWith("MODERATE");
  });

  it("calls onClose when the backdrop or the close button is pressed", async () => {
    const props = await renderSheet();

    await fireEvent.press(screen.getByText("Tamam"));

    expect(props.onClose).toHaveBeenCalled();
  });
});
