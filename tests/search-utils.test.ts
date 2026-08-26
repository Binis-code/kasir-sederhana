import { describe, it, expect } from "vitest";
import { getRecentQueries, bumpSkuFrequency, getFrequencyMap, rankProducts } from "../shared/search-utils.js";

type P = { id: string; name: string; barcode?: string | null };

const PRODUCTS: P[] = [
  { id: "1", name: "Beras Pandan Wangi", barcode: "8991002110012" },
  { id: "2", name: "Gula Pasir", barcode: "8992761110011" },
  { id: "3", name: "Bimoli Minyak Goreng", barcode: "8992388110010" },
];

describe("localStorage guards (node env)", () => {
  it("getRecentQueries aman tanpa window", () => {
    expect(getRecentQueries()).toEqual([]);
  });
  it("bumpSkuFrequency & getFrequencyMap noop tanpa window", () => {
    bumpSkuFrequency("1:1");
    expect(getFrequencyMap()).toEqual({});
  });
});

describe("rankProducts", () => {
  it("mencocokkan nama (case-insensitive) dan mengurutkan frekuensi", () => {
    const ranked = rankProducts(PRODUCTS, "beras", { "1": 5 });
    expect(ranked[0].id).toBe("1");
  });
  it("mencocokkan barcode", () => {
    const ranked = rankProducts(PRODUCTS, "8992388110010", {});
    expect(ranked.map(p => p.id)).toEqual(["3"]);
  });
  it("frekuensi lebih tinggi mendahului", () => {
    const list = [PRODUCTS[0], PRODUCTS[2]];
    const ranked = rankProducts(list, "a", { "3": 9, "1": 1 });
    expect(ranked[0].id).toBe("3");
  });
  it("query kosong mengembalikan kosong", () => {
    expect(rankProducts(PRODUCTS, "   ", {})).toEqual([]);
  });
});
