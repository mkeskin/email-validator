import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/index.ts",
  external: ["@email-validator/core"],
  output: { file: "dist/index.js", format: "es", sourcemap: true },
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: false,
      declarationMap: false,
    }),
  ],
};
