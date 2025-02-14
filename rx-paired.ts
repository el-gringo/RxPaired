#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_BASE_PATH,
  DEFAULT_HISTORY_SIZE,
  DEFAULT_MAX_TOKEN_DURATION,
  DEFAULT_MAX_LOG_LENGTH,
  DEFAULT_WRONG_PASSWORD_LIMIT,
  DEFAULT_DEVICE_CONNECTION_LIMIT,
  DEFAULT_INSPECTOR_CONNECTION_LIMIT,
  DEFAULT_DEVICE_MESSAGE_LIMIT,
  DEFAULT_INSPECTOR_MESSAGE_LIMIT,
  DEFAULT_LOG_FILE_PATH,
  DEFAULT_SERVER_HOST,
  DEFAULT_SERVER_PORT,
} from "./server/src/constants.ts";
import RxPairedServer from "./server/src/main.ts";
import buildClient from "./client/build.mjs";
import buildInspector from "./inspector/build.mjs";
import startStaticHttpServer from "./utils/static_http_server.mjs";

const currentDirName = getCurrentDirectoryName();

const { argv } = process;
if (argv.includes("-h") || argv.includes("--help")) {
  displayHelp();
  process.exit(0);
}

let serverUrl: URL;
let password: string;
let noInspector = false;
let httpHost = DEFAULT_SERVER_HOST;
let httpPort = DEFAULT_SERVER_PORT;

for (let i = 2; i < argv.length; i++) {
  const arg = argv[i].trim();
  switch (arg) {
    case "--url":
      ++i;
      if (argv[i] === undefined) {
        console.error(`Missing url argument for "--url" option.`);
        process.exit(1);
      } else if (!(serverUrl = URL.parse(argv[i]))) {
        console.error(
          `Invalid url argument for "--url" option. ` +
            `Must be a valid URL, got "${argv[i]}"`,
        );
        process.exit(1);
      }
      break;
    case "--host":
      httpHost = argv[++i];
      break;
    case "--port":
      httpPort = checkIntArg(arg, argv[++i]);
      break;
    case "--no-inspector":
      noInspector = true;
      break;
    case "--password":
      ++i;
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

if (!serverUrl) {
  serverUrl = new URL(`http://${httpHost}:${httpPort}/`);
}

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

startRxPaired({ password, httpHost, httpPort, noInspector });

export default function startRxPaired({
  password,
  httpHost,
  httpPort,
  devicePort,
  inspectorPort,
  noInspector,
} = {}) {
  const noPassword = typeof password !== "string" || password.length === 0;
  const serverOpts = {
    basePath: serverUrl.pathname ?? DEFAULT_BASE_PATH,
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

  const inspectorDebuggerUrl = serverUrl.toString();
  const deviceDebuggerUrl = `${inspectorDebuggerUrl.replace(/^http/, 'ws')}/device`;
  const deviceScriptUrl = `${inspectorDebuggerUrl.replace(/\/$/, '')}/client.js`;

  let tokenValue = noInspector
    ? password === null
      ? '!notoken'
      : `!notoken/${password}`
    : null;

  console.log("Starting RxPaired...");

  if (httpPort <= 0) {
    return;
  }

  Promise.race([
    startServer({ serverOpts, httpHost, httpPort }),
    noInspector
          ? Promise.resolve()
          : buildInspector({
              minify: true,
              watch: false,
              plugins: [],
              deviceScriptUrl,
              inspectorDebuggerUrl,
              noPassword
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
      tokenValue
    }).catch((err) => {
      console.error(
        `\x1b[31m[${getHumanReadableHours()}]\x1b[0m Client build failed:`,
        err,
      );
      process.exit(1);
    }),
  ]);
}

function startServer({ serverOpts, httpHost, httpPort }) {
  const { basePath } = serverOpts;

  RxPairedServer(serverOpts)
    .then(({ htmlInspectorSocket, deviceSocket }) => {
      const server = startStaticHttpServer(basePath, servedFiles, httpHost, httpPort, true);
      server.on("upgrade", function upgrade(request, socket, head) {
        if (!request.url) return;
        let { pathname } = new URL(request.url, "http://127.0.0.1");
        if (basePath.length > 1) {
          pathname = pathname.slice(basePath.length);
        }
        if (!noInspector && pathname.startsWith("/inspector/")) {
          htmlInspectorSocket.handleUpgrade(
            request,
            socket,
            head,
            function done(ws) {
              htmlInspectorSocket.emit("connection", ws, request);
            },
          );
        } else if (pathname.startsWith("/device/")) {
          deviceSocket.handleUpgrade(request, socket, head, function done(ws) {
            deviceSocket.emit("connection", ws, request);
          });
        } else {
          socket.destroy();
        }
      });

      console.log("");
      console.log("RxPaired started with success!");
      const clientPath = path.join(currentDirName, "client/client.js");
      if (httpPort > 0) {
        if (noInspector) {
          console.log(
            `You may load the client script at ${deviceScriptUrl} or find it in \`${clientPath}\`.`,
          );
        } else {
          console.log(
            `To start the inspector, go to ${serverUrl}`,
          );
        }
      }
    })
    .catch((err) => {
      console.error(
        `\x1b[31m[${getHumanReadableHours()}]\x1b[0m Server build failed:`,
        err,
      );
      process.exit(1);
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
    `Usage: rx-paired [options]
Options:

  -h, --help                     Display this help

  --url <url>                    Specify the full URL the server will be deployed.
                                 Default to 'http://${DEFAULT_SERVER_HOST}:${DEFAULT_SERVER_PORT}'

  --password <alphanumeric>      Optional password used by the server.
                                 Ignore for no password.

  --host <host>                  Listening hostname the server has to bind to.
                                 Defaults to ${DEFAULT_SERVER_HOST}.

  --port <port>                  Listening TCP port.
                                 Defaults to ${DEFAULT_SERVER_PORT}.
                                 You may set it to "-1" to disable the static server.

  --no-inspector                 If this option is present, we won't serve the
                                 inspector page nor rely on it for "token" creation.
                                 In effect, RxPaired will mostly act as a log server and
                                 create local files as new clients connect to it.`,
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


/**
 * Returns the current time in a human-readable format.
 * @returns {string}
 */
function getHumanReadableHours() {
  const date = new Date();
  return (
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0") +
    ":" +
    String(date.getSeconds()).padStart(2, "0") +
    "." +
    String(date.getMilliseconds()).padStart(4, "0")
  );
}
