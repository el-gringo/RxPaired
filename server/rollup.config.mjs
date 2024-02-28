import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";

export default {
  input: "build/main.js",
  output: {
    file: "RxPaired-server.bundle.mjs",
    format: "es",
  },
  plugins: [commonjs(), nodeResolve()],
};
