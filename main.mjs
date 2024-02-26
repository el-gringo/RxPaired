import path from "path";
import { fileURLToPath } from "url";
import {
  DEFAULT_INSPECTOR_PORT,
  DEFAULT_DEVICE_PORT,
  DEFAULT_HISTORY_SIZE,
  DEFAULT_MAX_TOKEN_DURATION,
  DEFAULT_MAX_LOG_LENGTH,
  DEFAULT_WRONG_PASSWORD_LIMIT,
  DEFAULT_DEVICE_CONNECTION_LIMIT,
  DEFAULT_INSPECTOR_CONNECTION_LIMIT,
  DEFAULT_DEVICE_MESSAGE_LIMIT,
  DEFAULT_INSPECTOR_MESSAGE_LIMIT,
  DEFAULT_LOG_FILE_PATH,
} from "./server/build/constants.js";
import RxPairedServer from "./server/build/main.js";
import buildClient from "./client/build.mjs";
import buildInspector from "./inspector/build.mjs";
import startStaticHttpServer from "./utils/static_http_server.mjs";

const currentDirName = getCurrentDirectoryName();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // The script has been run directly

  const { argv } = process;
  if (argv.includes("-h") || argv.includes("--help")) {
    displayHelp();
    process.exit(0);
  }

  let password = null;
  let inspectorPort;
  let devicePort;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i].trim();
    switch (arg) {
      case "--device-port":
        i++;
        inspectorPort = checkIntArg(arg, argv[i]);
        break;
      case "--inspector-port":
        i++;
        devicePort = checkIntArg(arg, argv[i]);
        break;
      case "--password":
        i++;
        if (argv[i] === undefined) {
          console.error(`Missing password argument for "--password" option.`);
          process.exit(1);
        } else if (!/^[A-Za-z0-9]+$/.test(argv[i])) {
          console.error(
            `Invalid password argument for "--password" option. ` +
              `Must be only alphanumeric characters, got "${argv[i]}"`,
          );
          process.exit(1);
        }
        password = argv[i];
        break;

      default:
        console.error(`Unknown option: "${arg}"`);
        process.exit(1);
    }
  }

  startRxPaired({ password, devicePort, inspectorPort });
}

export default function startRxPaired({
  password,
  devicePort,
  inspectorPort,
} = {}) {
  const noPassword = typeof password !== "string" || password.length === 0;
  const serverOpts = {
    inspectorPort: inspectorPort ?? DEFAULT_INSPECTOR_PORT,
    devicePort: devicePort ?? DEFAULT_DEVICE_PORT,
    shouldCreateLogFiles: true,
    password: noPassword ? null : password,
    historySize: DEFAULT_HISTORY_SIZE,
    maxTokenDuration: DEFAULT_MAX_TOKEN_DURATION,
    maxLogLength: DEFAULT_MAX_LOG_LENGTH,
    wrongPasswordLimit: DEFAULT_WRONG_PASSWORD_LIMIT,
    inspectorConnectionLimit: DEFAULT_INSPECTOR_CONNECTION_LIMIT,
    deviceConnectionLimit: DEFAULT_DEVICE_CONNECTION_LIMIT,
    deviceMessageLimit: DEFAULT_DEVICE_MESSAGE_LIMIT,
    inspectorMessageLimit: DEFAULT_INSPECTOR_MESSAGE_LIMIT,
    persistentTokensFile: null,
    logFile: DEFAULT_LOG_FILE_PATH,
    disableNoToken: false,
  };

  const staticServerPort = 8695;
  const deviceDebuggerUrl = `ws://127.0.0.1:${serverOpts.devicePort}`;
  const deviceScriptUrl = `http://127.0.0.1:${staticServerPort}/client.js`;
  const inspectorDebuggerUrl = `ws://127.0.0.1:${serverOpts.inspectorPort}`;

  console.log("Starting RxPaired...");
  Promise.race([
    RxPairedServer(serverOpts).catch((err) => {
      console.error(
        `\x1b[31m[${getHumanReadableHours()}]\x1b[0m Server build failed:`,
        err,
      );
      process.exit(1);
    }),

    buildInspector({
      minify: true,
      watch: false,
      plugins: [],
      deviceScriptUrl,
      inspectorDebuggerUrl,
      noPassword,
    }).catch((err) => {
      console.error(
        `\x1b[31m[${getHumanReadableHours()}]\x1b[0m Inspector build failed:`,
        err,
      );
      process.exit(1);
    }),

    buildClient({
      minify: true,
      watch: false,
      plugins: [],
      deviceDebuggerUrl,
    }).catch((err) => {
      console.error(
        `\x1b[31m[${getHumanReadableHours()}]\x1b[0m Client build failed:`,
        err,
      );
      process.exit(1);
    }),
  ])
    .then(() => {
      const servedFiles = {
        "index.html": {
          path: path.join(currentDirName, "inspector", "index.html"),
          contentType: "text/html; charset=UTF-8",
        },

        // Yes, an empty string is actually a valid key!
        "": {
          path: path.join(currentDirName, "inspector", "index.html"),
          contentType: "text/html; charset=UTF-8",
        },

        "inspector.js": {
          path: path.join(currentDirName, "inspector", "inspector.js"),
          contentType: "application/javascript; charset=UTF-8",
        },

        "client.js": {
          path: path.join(currentDirName, "client", "client.js"),
          contentType: "application/javascript; charset=UTF-8",
        },
      };

      return startStaticHttpServer(servedFiles, staticServerPort, true);
    })
    .then(() => {
      console.log("");
      console.log("RxPaired started with success!");
      console.log(
        `To start using it, go to http://127.0.0.1:${staticServerPort}/`,
      );
    });
}

/**
 * Returns the path to the directory where the current script is found.
 * @returns {String}
 */
function getCurrentDirectoryName() {
  return path.dirname(fileURLToPath(import.meta.url));
}

/**
 * Display through `console.log` an helping message relative to how to run this
 * script.
 */
function displayHelp() {
  console.log(
    /* eslint-disable indent */
    `Usage: node static_http_server.mjs [options]
Options:

  -h, --help                     Display this help

  --password <alphanumeric>      Optional password used by the server.
                                 Ignore for no password.

  --devicePort <port>            Port used for device-to-server communication.
                                 Defaults to ${DEFAULT_DEVICE_PORT}.

  --inspectorPort <port>         Port used for inspector-to-server communication.
                                 Defaults to ${DEFAULT_INSPECTOR_PORT}.`,
    /* eslint-enable indent */
  );
}

function checkIntArg(arg, val) {
  const toInt = val === undefined ? NaN : Number(val);
  if (isNaN(toInt)) {
    if (val === undefined || val.startsWith("-")) {
      console.error(`Missing argument for "${arg}" option.`);
    } else {
      console.error(
        `Invalid "${arg}" argument. Expected a number, ` + `ot "${val}".`,
      );
    }
    process.exit(1);
  } else if (toInt % 1 !== 0) {
    console.error(
      `Invalid "${arg}" argument. Expected an integer, ` + `got "${val}".`,
    );
    process.exit(1);
  }
  return toInt;
}
