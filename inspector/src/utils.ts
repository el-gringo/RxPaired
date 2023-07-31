import { createElement } from "./dom-utils";
import modules from "./modules/index";

/**
 * Re-generate the page URL according to the communicated arguments.
 *
 * Format of the hash:
 * #!pass=<SERVER_SIDE_CHECKED_PASSWORD>!token=<TOKEN>
 * The password is mandatory, the token is only set if it has been generated.
 *
 * @param {string|null|undefined} withPassword - Current password inputed.
 * `null` for no password.
 * `undefined` if no password has been inputed for now.
 * @param {string|undefined} withToken - Current token inputed.
 * `undefined` if no token has been inputed for now.
 * @returns {string}
 */
export function reGeneratePageUrl(
  withPassword: string | null | undefined,
  withToken: string | undefined
): string {
  const originalUrl = new URL(document.location.href);
  originalUrl.hash = "";
  let url = originalUrl.toString();
  if (withPassword !== undefined) {
    url += "#!pass=" + (withPassword ?? "");
    if (withToken !== undefined) {
      url += "!token=" + withToken;
    }
  }
  return url;
}

/**
 * Parse information that can be gathered from the current URL
 * @returns {Object} urlInfo
 * @returns {boolean} urlInfo.isPostDebugger - If `true` we should be running
 * the "post-debugging" page.
 * @returns {string|null|undefined} urlInfo.password - Current password inputed.
 * `null` for no password.
 * `undefined` if no password has been inputed for now.
 * @returns {string|undefined} urlInfo.tokenId - Current token inputed.
 * `undefined` if no token has been inputed for now.
 */
export function parseUrl(): {
  isPostDebugger: boolean;
  password: string | null | undefined;
  tokenId: string | undefined;
} {
  let password;
  let tokenId;
  const initialHashValues = window.location.hash.split("!");
  const isPostDebugger =
    initialHashValues.filter((val) => val.startsWith("post"))[0] !== undefined;
  const passStr = initialHashValues.filter((val) => val.startsWith("pass="))[0];
  if (passStr !== undefined) {
    password = passStr.substring("pass=".length);
    password = password.length === 0 ? null : password;
    const tokenStr = initialHashValues.filter((val) =>
      val.startsWith("token=")
    )[0];
    if (tokenStr !== undefined) {
      tokenId = tokenStr.substring("token=".length);
    }
  }
  return { isPostDebugger, password, tokenId };
}

/**
 * @param {string} tokenId
 */
export function checkTokenValidity(tokenId: string): void {
  if (!/^[A-Za-z0-9]+$/.test(tokenId)) {
    const error = new Error(
      "Error: Your token must only contain alphanumeric characters"
    );
    displayError(error);
    throw error;
  }
}

/**
 * Display error message given on the top of the page.
 * @param {Error|string} [err] - The Error encountered.
 */
export function displayError(err?: unknown): void {
  let message;
  if (err != null) {
    if (typeof err === "string") {
      message = err;
    } else if (typeof (err as Error).message === "string") {
      message = (err as Error).message;
    }
  }
  if (message === undefined) {
    message = "Encountered unknown Error";
  }

  const errorDiv = createElement("div", {
    className: "error-msg",
    textContent: `${new Date().toISOString()}: Error: ${message}`,
  });
  const bodyElements = document.body.children;
  if (bodyElements.length > 0) {
    document.body.insertBefore(errorDiv, bodyElements[0]);
  } else {
    document.body.appendChild(errorDiv);
  }
}

/**
 * @returns {Array.<string>}
 */
export function getDefaultModuleOrder(): string[] {
  return modules.map(({ moduleId }) => moduleId);
}
