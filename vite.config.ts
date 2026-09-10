import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
  },
  staged: {
    "*": "vp check --fix",
  },
  pack: {
    deps: { resolveDepSubpath: true },
    dts: {
      generator: "tsgo",
    },
    exports: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
