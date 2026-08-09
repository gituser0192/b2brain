import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:5000/api/v1"),
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
