#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import esbuild from "esbuild";
import { fileURLToPath } from "node:url";

const currentDirName = getCurrentDirectoryName();


/**
 * Build the client with the given options.
 * @param {Object} options
 * @param {string} options.deviceDebuggerUrl - URL to contact the RxPaired
 * server.
 * @param {boolean} [options.minify] - If `true`, the output will be minified.
 * @param {boolean} [options.watch] - If `true`, the files involved
 * will be watched and the code re-built each time one of them changes.
 * @param {Array} [options.plugins]
 * @param {String|null} [options.tokenValue]
 * @returns {Promise}
 */
export default function buildClient(options) {
  const minify = !!options.minify;
  const watch = !!options.watch;
  const esbuildOpts = {
    entryPoints: [path.join(currentDirName, "src", "client.js")],
    bundle: true,
    format: "esm",
    minifySyntax: minify,
    minifyWhitespace: minify,
    target: "es6",
    outfile: path.join(currentDirName, "client.js"),
    legalComments: "inline",
    plugins: options.plugins,
    define: {
      _BUILD_TIME_TOKEN_VALUE_: JSON.stringify(options.tokenValue ?? null),
    },
  };
  return watch
    ? esbuild.context(esbuildOpts).then((context) => {
        context.watch();
      })
    : esbuild.build(esbuildOpts);
}

/**
 * Returns the path to the directory where the current script is found.
 * @returns {String}
 */
function getCurrentDirectoryName() {
  return path.dirname(fileURLToPath(import.meta.url));
}
