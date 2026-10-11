import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SUBCATEGORIES, MasterStore, STORAGE_KEYS } from "./store";

describe("subcategory store", () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts without demo subcategories", () => {
    expect(DEFAULT_SUBCATEGORIES).toEqual([]);
    expect(MasterStore.getSubCategories()).toEqual([]);
  });

  it("creates, updates, filters, and deletes configured subcategories", () => {
    const created = MasterStore.addSubCategory({
      categoryId: "cat-food",
      name: "เส้นก๋วยเตี๋ยว",
      code: "NOO",
    });

    expect(created.id).toMatch(/^sub-/);
    expect(MasterStore.getSubCategories("cat-food")).toEqual([created]);
    expect(MasterStore.getSubCategories("cat-beverage")).toEqual([]);

    MasterStore.updateSubCategory(created.id, { name: "เส้นสด", code: "FNO" });
    expect(MasterStore.getSubCategories()[0]).toMatchObject({
      id: created.id,
      categoryId: "cat-food",
      name: "เส้นสด",
      code: "FNO",
    });

    MasterStore.deleteSubCategory(created.id);
    expect(MasterStore.getSubCategories()).toEqual([]);
    expect(JSON.parse(values.get(STORAGE_KEYS.SUBCATEGORIES) || "null")).toEqual([]);
  });
});
