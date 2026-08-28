import { router, adminProcedure } from "../trpc/index.js";
import fs from "node:fs";
import path from "node:path";

const BACKUP_DIR = path.resolve(process.cwd(), "backups");
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export const backupRouter = router({
  createSnapshot: adminProcedure.mutation(async () => {
    const src = path.resolve(process.cwd(), "kios_nusa.db");
    if (!fs.existsSync(src)) {
      throw new Error("Database kios_nusa.db belum ditemukan.");
    }
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    const filename = `kios_nusa_backup_${timestamp}.db`;
    const dest = path.join(BACKUP_DIR, filename);

    fs.copyFileSync(src, dest);
    const stats = fs.statSync(dest);

    return {
      filename,
      sizeBytes: stats.size,
      createdAt: d.toISOString(),
    };
  }),

  listSnapshots: adminProcedure.query(async () => {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith(".db"));
    return files.map(filename => {
      const fullPath = path.join(BACKUP_DIR, filename);
      const stats = fs.statSync(fullPath);
      return {
        filename,
        sizeBytes: stats.size,
        createdAt: stats.mtime.toISOString(),
      };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }),
});
