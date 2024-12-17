import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const currentDirName = getCurrentDirectoryName();


/**
 * Build the inspector with the given options.
 * @param {Object} options
 * @param {string} options.inspectorDebuggerUrl - URL to contact the RxPaired
 * server.
 * @param {string|null|undefined} [options.deviceScriptUrl] - URL where the
 * RxPaired client script may be fetched.
 * @param {boolean|null|undefined} [options.noPassword] - If `true` the
 * password page will never be displayed.
 * @param {boolean} [options.minify] - If `true`, the output will be minified.
 * @param {boolean} [options.watch] - If `true`, the files involved
 * will be watched and the code re-built each time one of them changes.
 * @param {Array|undefined} [plugins]
 * @returns {Promise}
 */
export default function buildWebInspector(options) {
  const minify = !!options.minify;
  const watch = !!options.watch;
  const esbuildOpts = {
    entryPoints: [path.join(currentDirName, "src", "index.ts")],
    bundle: true,
    minify,
    plugins: options.plugins,
    outfile: path.join(currentDirName, "inspector.js"),
    define: {
      _INSPECTOR_DEBUGGER_URL_: JSON.stringify(options.inspectorDebuggerUrl),
      __DEVICE_SCRIPT_URL__: JSON.stringify(options.deviceScriptUrl ?? null),
      __DISABLE_PASSWORD__: JSON.stringify(options.noPassword ?? false),
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
