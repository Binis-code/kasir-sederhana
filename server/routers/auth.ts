import { router, publicProcedure, protectedProcedure } from "../trpc/index.js";
import { z } from "zod";

export const authRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    return ctx.user ?? null;
  }),
});


