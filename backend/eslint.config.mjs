import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "src/generated/**", "eslint.config.mjs", "prisma/seed.ts"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  { languageOptions: { parserOptions: { projectService: { allowDefaultProject: ["tests/*.ts", "vitest.config.ts"], maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 40 }, tsconfigRootDir: import.meta.dirname } } },
);
