import "dotenv/config";
import { db, closePool } from "../server/db.js";
import { users, suppliers, products, productVariants, inventoryMovements, vouchers, discountRules, sales, saleItems, salePayments, receivables } from "../drizzle/schema.js";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "../server/auth.js";

const p = (n: number) => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

async function upsertUser(username: string, password: string, name: string, role: string) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (existing) return existing.id;
  const passwordHash = await hashPassword(password);
  const res = await db.insert(users).values({ username, name, role, passwordHash, loginMethod: "password" }).$returningId();
  console.log(`+ user ${username} (${role})`);
  return Number(res[0].id);
}

type SeedProduct = {
  name: string; category: string; barcode: string | null; minStock: number;
  variants: { label: string; barcode: string | null; sellingPrice: number; costPrice: number; stock: number }[];
};

const CATALOG: SeedProduct[] = [
  { name: "Beras Pandan Wangi", category: "Sembako", barcode: "8991002100015", minStock: 5,
    variants: [
      { label: "Karung 5 kg", barcode: "8991002110012", sellingPrice: 72000, costPrice: 63000, stock: 12 },
      { label: "Karung 10 kg", barcode: "8991002120019", sellingPrice: 140000, costPrice: 124000, stock: 6 },
    ] },
  { name: "Gula Pasir Gulaku", category: "Sembako", barcode: "8992761100014", minStock: 8,
    variants: [
      { label: "Pack 1 kg", barcode: "8992761110011", sellingPrice: 17500, costPrice: 15200, stock: 24 },
    ] },
  { name: "Minyak Goreng Bimoli", category: "Sembako", barcode: "8992388100013", minStock: 10,
    variants: [
      { label: "Botol 1 L", barcode: "8992388110010", sellingPrice: 19500, costPrice: 17200, stock: 18 },
      { label: "Botol 2 L", barcode: "8992388120017", sellingPrice: 38000, costPrice: 33800, stock: 9 },
    ] },
  { name: "Tepung Terigu Segitiga", category: "Sembako", barcode: "8992696400019", minStock: 6,
    variants: [{ label: "Pack 1 kg", barcode: "8992696410016", sellingPrice: 13000, costPrice: 11200, stock: 15 }] },
  { name: "Mie Instan Indomie Goreng", category: "Makanan", barcode: "8998866000118", minStock: 20,
    variants: [
      { label: "Sachet 85 g", barcode: "8998866010013", sellingPrice: 3500, costPrice: 2900, stock: 96 },
      { label: "Karton 40 pcs", barcode: "8998866020010", sellingPrice: 128000, costPrice: 112000, stock: 4 },
    ] },
  { name: "Kopi Kapal Api Special", category: "Minuman", barcode: "8991003100014", minStock: 12,
    variants: [{ label: "Sachet 165 g", barcode: "8991003110011", sellingPrice: 12500, costPrice: 10600, stock: 22 }] },
  { name: "Teh Botol Sosro", category: "Minuman", barcode: "8996001600058", minStock: 12,
    variants: [
      { label: "Botol 350 ml", barcode: "8996001610055", sellingPrice: 5000, costPrice: 3900, stock: 36 },
      { label: "Kotak 250 ml (6)", barcode: "8996001620052", sellingPrice: 21000, costPrice: 17800, stock: 8 },
    ] },
  { name: "Aqua Air Mineral", category: "Minuman", barcode: "8886008101053", minStock: 15,
    variants: [
      { label: "Botol 600 ml", barcode: "8886008111050", sellingPrice: 4000, costPrice: 2900, stock: 48 },
      { label: "Galon 19 L", barcode: "8886008121057", sellingPrice: 22000, costPrice: 19000, stock: 10 },
    ] },
  { name: "Susu Ultra Milk Full Cream", category: "Minuman", barcode: "8998009010017", minStock: 10,
    variants: [{ label: "Kotak 250 ml", barcode: "8998009020014", sellingPrice: 6500, costPrice: 5300, stock: 20 }] },
  { name: "Sabun Mandi Lifebuoy", category: "Kebersihan", barcode: "8999999521014", minStock: 8,
    variants: [{ label: "Batang 75 g", barcode: null, sellingPrice: 5500, costPrice: 4300, stock: 16 }] },
];

async function main() {
  console.log("== Seed Kios Nusa (idempoten) ==");

  const ownerUsername = process.env.OWNER_USERNAME ?? "owner";
  const ownerPassword = process.env.OWNER_PASSWORD ?? "nusa2026";
  const ownerId = await upsertUser(ownerUsername, ownerPassword, "Pemilik Toko", "owner");
  await upsertUser("admin", "admin123", "Admin Operasional", "admin");
  await upsertUser("kasir", "kasir123", "Kasir Shift 1", "kasir");

  const SUPPLIERS = [
    { name: "Toko Grosir Sumber Rezeki", phone: "0812-3456-7890", address: "Jl. Pasar Baru No. 21", notes: "Harga grosir min. 1 karton" },
    { name: "CV Sembako Nusantara", phone: "0813-9876-5432", address: "Jl. Industri Raya No. 5", notes: null as string | null },
    { name: "Agen Minuman Segar", phone: "0857-1122-3344", address: "Jl. Diponegoro No. 88", notes: "Delivery tiap Selasa & Jumat" },
  ];
  const supplierIds: number[] = [];
  for (const s of SUPPLIERS) {
    const [row] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.name, s.name)).limit(1);
    if (row) { supplierIds.push(row.id); continue; }
    const res = await db.insert(suppliers).values(s).$returningId();
    supplierIds.push(Number(res[0].id));
    console.log(`+ pemasok ${s.name}`);
  }

  let movementCount = 0;
  for (const sp of CATALOG) {
    const [existing] = await db.select({ id: products.id }).from(products).where(sql`${products.name} = ${sp.name}`).limit(1);
    if (existing) continue;

    const pres = await db.insert(products).values({
      name: sp.name, category: sp.category, barcode: sp.barcode, minStock: sp.minStock,
    }).$returningId();
    const productId = Number(pres[0].id);

    let totalStock = 0;
    for (const v of sp.variants) {
      const vres = await db.insert(productVariants).values({
        productId, label: v.label, barcode: v.barcode,
        sellingPrice: v.sellingPrice, costPrice: v.costPrice, stock: v.stock,
      }).$returningId();
      const variantId = Number(vres[0].id);
      if (v.stock > 0) {
        await db.insert(inventoryMovements).values({
          productId, variantId, type: "purchase", qty: v.stock,
          refType: "seed", note: "Stok awal seed", createdBy: ownerId,
        });
        movementCount++;
      }
      totalStock += v.stock;
    }
    await db.update(products).set({ stock: totalStock }).where(eq(products.id, productId));
    console.log(`+ produk ${sp.name} (${sp.variants.length} varian)`);
  }

  const voucherDefs = [
    { code: "HEMAT10", type: "percentage", value: 10, minPurchase: 50000, maxDiscount: 15000 as number | null, validFrom: "2026-01-01", validUntil: "2027-12-31" as string | null, usageLimit: 1000 as number | null },
    { code: "GRATIS5000", type: "fixed", value: 5000, minPurchase: 30000, maxDiscount: null as number | null, validFrom: "2026-01-01", validUntil: "2027-12-31" as string | null, usageLimit: null as number | null },
  ];
  for (const v of voucherDefs) {
    const [dup] = await db.select({ id: vouchers.id }).from(vouchers).where(eq(vouchers.code, v.code)).limit(1);
    if (!dup) {
      await db.insert(vouchers).values({ ...v, isActive: true });
      console.log(`+ voucher ${v.code}`);
    }
  }
  const [ruleDup] = await db.select({ id: discountRules.id }).from(discountRules).limit(1);
  if (!ruleDup) {
    await db.insert(discountRules).values({
      name: "Diskon Member 5%", type: "percentage", value: 5, minPurchase: 20000, isActive: true,
    });
    console.log("+ aturan diskon member");
  }

  if ((process.env.SEED_DEMO_SALES ?? "1") === "1") {
    const demoInvoice = `INV-${today().replace(/-/g, "")}-SEED`;
    const [saleDup] = await db.select({ id: sales.id }).from(sales).where(eq(sales.invoiceNo, demoInvoice)).limit(1);
    if (!saleDup) {
      const [beras] = await db.select().from(productVariants).where(sql`${productVariants.barcode} = '8991002110012'`).limit(1);
      const [aqua] = await db.select().from(productVariants).where(sql`${productVariants.barcode} = '8886008111050'`).limit(1);
      if (beras && aqua) {
        const lines = [
          { v: beras, qty: 1 },
          { v: aqua, qty: 3 },
        ];
        const subtotal = lines.reduce((s, l) => s + l.v.sellingPrice * l.qty, 0);
        const total = subtotal;
        const paidCash = 100000;
        const change = Math.max(0, paidCash - total);
        const sres = await db.insert(sales).values({
          invoiceNo: demoInvoice, cashierId: ownerId, subtotal,
          discountTotal: 0, total, paymentMethod: "cash",
          paidAmount: Math.min(paidCash, total), changeAmount: change, status: "completed",
        }).$returningId();
        const saleId = Number(sres[0].id);
        for (const l of lines) {
          await db.insert(saleItems).values({
            saleId, productId: l.v.productId, variantId: l.v.id,
            name: `${CATALOG.find(c => c.variants.some(x => x.barcode === l.v.barcode))?.name ?? "Produk"} — ${l.v.label}`,
            qty: l.qty, unitPrice: l.v.sellingPrice, discount: 0,
            lineTotal: l.qty * l.v.sellingPrice,
          });
          await db.update(productVariants).set({ stock: sql`${productVariants.stock} - ${l.qty}` }).where(eq(productVariants.id, l.v.id));
          await db.update(products).set({ stock: sql`${products.stock} - ${l.qty}` }).where(eq(products.id, l.v.productId));
          await db.insert(inventoryMovements).values({
            productId: l.v.productId, variantId: l.v.id, type: "sale", qty: -l.qty,
            refType: "sale", refId: saleId, note: `Penjualan ${demoInvoice}`, createdBy: ownerId,
          });
        }
        await db.insert(salePayments).values({ saleId, method: "cash", amount: Math.min(paidCash, total) });

        const yesterday = new Date(Date.now() - 86400000);
        const dueStr = `${yesterday.getFullYear()}-${p(yesterday.getMonth() + 1)}-${p(yesterday.getDate())}`;
        const [mie] = await db.select().from(productVariants).where(sql`${productVariants.barcode} = '8998866010013'`).limit(1);
        if (mie) {
          const rTotal = mie.sellingPrice * 10;
          const sres2 = await db.insert(sales).values({
            invoiceNo: `${demoInvoice}-K`, cashierId: ownerId, subtotal: rTotal,
            discountTotal: 0, total: rTotal, paymentMethod: "kredit",
            paidAmount: 0, changeAmount: 0, status: "completed",
            customerName: "Warung Bu Sari", dueDate: dueStr,
          }).$returningId();
          const saleId2 = Number(sres2[0].id);
          await db.insert(saleItems).values({
            saleId: saleId2, productId: mie.productId, variantId: mie.id,
            name: `Mie Instan Indomie Goreng — ${mie.label}`,
            qty: 10, unitPrice: mie.sellingPrice, discount: 0, lineTotal: rTotal,
          });
          await db.update(productVariants).set({ stock: sql`${productVariants.stock} - 10` }).where(eq(productVariants.id, mie.id));
          await db.update(products).set({ stock: sql`${products.stock} - 10` }).where(eq(products.id, mie.productId));
          await db.insert(inventoryMovements).values({
            productId: mie.productId, variantId: mie.id, type: "sale", qty: -10,
            refType: "sale", refId: saleId2, note: `Penjualan kredit ${demoInvoice}-K`, createdBy: ownerId,
          });
          await db.insert(salePayments).values({ saleId: saleId2, method: "kredit", amount: 0 });
          await db.insert(receivables).values({
            saleId: saleId2, customerName: "Warung Bu Sari", amount: rTotal,
            paidAmount: 0, dueDate: dueStr, status: "open",
          });
        }
        console.log("+ transaksi demo & piutang contoh");
      }
    }
  }

  console.log(`Seed selesai. Mutasi awal: ${movementCount}.`);
  console.log(`Login owner: ${ownerUsername} / password dari OWNER_PASSWORD (.env)`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => closePool());
