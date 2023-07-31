import { performance } from "perf_hooks";
import WebSocket from "ws";

export default new (class ActiveTokensList {

  /** List of token currently used. */
  private _tokensList : TokenMetadata[];

  constructor() {
    this._tokensList = [];
  }

  /**
   * Create a new token with a given ID and log history size.
   * @param {string} tokenId
   * @param {number} historySize
   * @returns {Object}
   */
  public create(tokenId : string, historySize : number) : TokenMetadata {
    const tokenMetadata = new TokenMetadata(tokenId, historySize);
    this._tokensList.push(tokenMetadata);
    return tokenMetadata;
  }

  /**
   * Returns public information that can be accessed by inspectors about all
   * active tokens.
   * @returns {Array.<Object>}
   */
  public listPublicInformation() : Array<{ tokenId: string; date: number }> {
    return this._tokensList.map((t) => {
      return { tokenId: t.tokenId, date: t.date };
    });
  }

  /**
   * Retrieve an active token from its index number (which can be from `0` to
   * one minus the list's size that can be known by calling the `size` method).
   *
   * Returns `undefined` if there's no token at that index.
   * @param {number} idx
   * @returns {Object|undefined}
   */
  public getFromIndex(idx : number) : TokenMetadata | undefined {
    return this._tokensList[idx];
  }

  /**
   * Removes an active token from its index number (which can be from `0` to
   * one minus the list's size that can be known by calling the `size` method).
   *
   * Returns `undefined` if there was no token at that index or the
   * corresponding `TokenMetadata` if there was.
   * @param {number} idx
   * @returns {Object|undefined}
   */
  public removeIndex(idx : number) : TokenMetadata | undefined {
    return this._tokensList.splice(idx, 1)[0];
  }

  /**
   * Returns the number of currently active tokens in this `ActiveTokensList`.
   *
   * This value can then be used to infer all "indexes" that can be given to
   * methods such as `getFromIndex` or `removeIndex`.
   * @returns {number}
   */
  public size() : number {
    return this._tokensList.length;
  }

  /**
   * Get the index number of the first token stored which has the given
   * `tokenId`.
   * Returns `-1` if no token uses that id.
   * @param {string} tokenId
   * @returns {number}
   */
  public findIndex(tokenId : string) : number {
    return this._tokensList.findIndex((t) => t.tokenId === tokenId);
  }

  /**
   * Get the `TokenMetadata` object of the first token stored which has the
   * given `tokenId`.
   * Returns `undefined` if no token uses that id.
   * @param {string} tokenId
   * @returns {Object|undefined}
   */
  public find(tokenId : string) : TokenMetadata | undefined {
    return this._tokensList.find((t) => t.tokenId === tokenId);
  }
})();

/** First metadata received when a device connects with a token. */
interface DeviceInitData {
  /**
   * Monotically increasing timestamp at which this Initialization data was
   * generated on the device, in milliseconds.
   */
  timestamp : number;
  /**
   * Unix timestamp on the device when this Initialization data was generated,
   * in milliseconds.
   */
  dateMs : number;
}

/**
 * Log history stored with a `TokenMetadata`.
 */
interface LogHistoryData {
  /** Logs from the most ancient to the newest. */
  history : string[];
  /** Maximum amount of logs that will be kept in this history. */
  maxHistorySize : number;
}

/**
 * For a given token ID, list store all inspectors and the potential device linked
 * to it.
 * @class TokenMetadata
 */
export class TokenMetadata {
  /**
   * ID identifying this token.
   * Used by inspectors and devices connecting through it.
   */
  public tokenId : string;

  /** Value of `performance.now()` at the time the TokenMetadata was created. */
  public timestamp : number;

  /** Value of `date.now()` at the time the TokenMetadata was created. */
  public date : number;

  /**
   * Information on each web "inspector" (remote debugger) connected with this
   * token.
   */
  public inspectors : Array<{
    /** Corresponding WebSocket on which logs are sent. */
    webSocket : WebSocket.WebSocket;
    /**
     * Store Timer ID of the interval at which `"ping"` messages are sent to
     * ensure the connection isn't closed by some mechanism (for example a
     * server watcher closing down the connection when it seems to be unused).
     */
    pingInterval : NodeJS.Timer;
  }>;

  /**
   * The device running with this token.
   * `null` if there's no device connected with it.
   *
   * There cannot be multiple devices connected with the same token.
   */
  public device : WebSocket.WebSocket | null;

  /**
   * Store Timer ID of the interval at which `"ping"` messages are sent to the
   * device to ensure the connection isn't closed by some mechanism (for example
   * a server watcher closing down the connection when it seems to be unused).
   */
  public pingInterval : NodeJS.Timer | null;

  /**
   * Initialization data received when the device connected with this
   * token.
   */
  private _initData : DeviceInitData | null;

  /**
   * History of the most recent logs associated with this token.
   */
  private _history : LogHistoryData;

  /**
   * @param {string} tokenId - ID identifying the token
   * @param {number} historySize - Maximum number of logs kept in the log
   * history associated with this token.
   */
  constructor(tokenId : string, historySize : number) {
    this.tokenId = tokenId;
    this.timestamp = performance.now();
    this.date = Date.now();
    this.inspectors = [];
    this.device = null;
    this.pingInterval = null;
    this._initData = null;
    this._history = {
      history: [],
      maxHistorySize: historySize,
    };
  }

  /**
   * Update of reset the `DeviceInitData` associated with this `TokenMetadata`.
   * @param {Object|null} initData
   */
  public setDeviceInitData(initData : DeviceInitData | null) : void {
    this._initData = initData;
    this._history.history = [];
  }

  /**
   * Get the `DeviceInitData` associated with this `TokenMetadata`.
   * Returns `null` if no `DeviceInitData` is associated.
   * @param {Object|null}
   */
  public getDeviceInitData() : DeviceInitData | null {
    return this._initData;
  }

  /**
   * Add a new log to this token's log history.
   * Removes the most ancient log if the maximum history size is already
   * reached.
   * @param {string} log - The Log line to add to history
   */
  public addLogToHistory(log : string) : void {
    if (this._history.maxHistorySize === 0) {
      return;
    }
    if (this._history.history.length >= this._history.maxHistorySize) {
      this._history.history.shift();
    }
    this._history.history.push(log);
  }

  /**
   * Returns the current log history associated with this token.
   * @returns {Object}
   */
  public getCurrentHistory() : { history : string[]; maxHistorySize : number } {
    return this._history;
  }
}
