// src/libasync.js

const { GET_request, POST_request } = require("./util");
const {
  EmptyQueryError,
  ProxyNotMatchError,
  NoProfileError,
  NoDomainError,
  NoIdError,
  ParseError, // Added missing import
} = require("./exception");
const logger = require("./logger");
const ZlibProfile = require("./profile");
const { SearchPaginator } = require("./abstract");
const BookItem = require("./bookItem");
const config = require("./config");

/**
 * Class representing the asynchronous interface to ZLibrary.
 */
class AsyncZlib {
  /**
   * Create an AsyncZlib instance.
   * @param {Object} options - Configuration options.
   * @param {boolean} [options.onion=false] - Use onion domains.
   * @param {string[]} [options.proxyList=[]] - List of proxies.
   * @param {boolean} [options.disableSemaphore=false] - Disable semaphore.
   * @param {Object} [options.customDomains={}] - Custom domains.
   * @throws {ProxyNotMatchError} If proxyList is not an array.
   * @throws {Error} If onion is true and proxyList is empty.
   */
  constructor(options = {}) {
    const {
      onion = false,
      proxyList = [],
      disableSemaphore = false,
      customDomains = {},
    } = options;

    if (proxyList && !Array.isArray(proxyList)) {
      throw new ProxyNotMatchError();
    }

    this.semaphore = !disableSemaphore;
    this.onion = onion;
    this.proxyList = proxyList;

    // Merge custom domains with default config
    this.domains = { ...config, ...customDomains };

    if (onion) {
      this.loginDomain = this.domains.LOGIN_TOR_DOMAIN;
      this.domain = this.domains.ZLIB_TOR_DOMAIN;
      this.mirror = this.domain;

      if (!proxyList || proxyList.length === 0) {
        throw new Error(
          "Tor proxy must be set to route through onion domains. Set up a tor service and use: onion=true, proxyList=['socks5://127.0.0.1:9050']"
        );
      }
    } else {
      this.loginDomain = this.domains.LOGIN_DOMAIN;
      this.domain = this.domains.ZLIB_DOMAIN;
      this.mirror = this.domains.ZLIB_DOMAIN;
    }

    this.cookies = null;
    this.profile = null;
  }

  /**
   * Internal method to make a GET request.
   * @param {string} url - The URL to request.
   * @param {boolean} [expectJson=false] - Whether to parse the response as JSON.
   * @returns {Promise<any>} The response data.
   * @throws {ParseError} If JSON parsing fails.
   */
  async _r(url, expectJson = false) {
    const response = await GET_request(url, this.cookies, this.proxyList);
    if (expectJson && typeof response === "string") {
      try {
        return JSON.parse(response);
      } catch (error) {
        throw new ParseError("Failed to parse JSON response.");
      }
    }
    return response;
  }

  /**
   * Login to ZLibrary.
   * @param {string} email - The email address.
   * @param {string} password - The password.
   * @returns {Promise<ZlibProfile>} The user profile.
   * @throws {Error} If no working domain is found.
   */
  async login(email, password) {
    const data = new URLSearchParams({
      isModal: "True",
      email,
      password,
      site_mode: "books",
      action: "login",
      isSingleLogin: "1",
      redirectUrl: "",
      gg_json_mode: "1",
    });

    const [resp, setCookies] = await POST_request(
      this.loginDomain,
      data,
      this.proxyList
    );

    // Process response and set cookies
    this.cookies = {};
    setCookies.forEach((cookieStr) => {
      const [cookiePair] = cookieStr.split(";");
      const [key, value] = cookiePair.split("=");
      this.cookies[key] = value;
    });

    logger.debug(`Set cookies: ${JSON.stringify(this.cookies)}`);

    if (this.onion) {
      const url = `${this.domain}/?remix_userkey=${this.cookies["remix_userkey"]}&remix_userid=${this.cookies["remix_userid"]}`;
      const [_, moreCookies] = await GET_request(
        url,
        this.cookies,
        this.proxyList,
        true
      );

      moreCookies.forEach((cookieStr) => {
        const [cookiePair] = cookieStr.split(";");
        const [key, value] = cookiePair.split("=");
        this.cookies[key] = value;
      });

      logger.debug(`Updated cookies: ${JSON.stringify(this.cookies)}`);
      logger.info(`Set working mirror: ${this.mirror}`);
    } else {
      this.mirror = this.domains.ZLIB_DOMAIN;

      if (!this.mirror) {
        throw new NoDomainError();
      }
    }

    this.profile = new ZlibProfile(
      this._r.bind(this),
      this.cookies,
      this.mirror,
      this.domain
    );
    return this.profile;
  }

  /**
   * Logout from ZLibrary.
   */
  async logout() {
    this.cookies = null;
    this.profile = null;
  }

  /**
   * Search for books.
   * @param {string} q - The search query.
   * @param {boolean} [exact=false] - Exact match.
   * @param {number|null} [fromYear=null] - Start year.
   * @param {number|null} [toYear=null] - End year.
   * @param {string[]} [lang=[]] - List of languages.
   * @param {string[]} [extensions=[]] - List of extensions.
   * @param {number} [count=10] - Number of results per page.
   * @returns {Promise<SearchPaginator>} The paginator.
   * @throws {NoProfileError} If not logged in.
   * @throws {EmptyQueryError} If query is empty.
   */
  async search(
    q = "",
    exact = false,
    fromYear = null,
    toYear = null,
    lang = [],
    extensions = [],
    count = 10
  ) {
    if (!this.profile) throw new NoProfileError();
    if (!q) throw new EmptyQueryError();

    let payload = `${this.mirror}/s/${encodeURIComponent(q)}?`;

    if (exact) payload += "&e=1";
    if (fromYear) payload += `&yearFrom=${fromYear}`;
    if (toYear) payload += `&yearTo=${toYear}`;

    if (lang && Array.isArray(lang)) {
      lang.forEach((l) => {
        payload += `&languages%5B%5D=${encodeURIComponent(
          typeof l === "string" ? l : l.value
        )}`;
      });
    }

    if (extensions && Array.isArray(extensions)) {
      extensions.forEach((ext) => {
        payload += `&extensions%5B%5D=${encodeURIComponent(
          typeof ext === "string" ? ext : ext.value
        )}`;
      });
    }

    const paginator = new SearchPaginator(
      payload,
      count,
      this._r.bind(this),
      this.mirror
    );
    await paginator.init();
    return paginator;
  }

  /**
   * Get a book by its ID.
   * @param {string} id - The book ID.
   * @returns {Promise<BookItem>} The book item.
   * @throws {NoIdError} If ID is not provided.
   */
  async getById(id = "") {
    if (!id) throw new NoIdError();

    const book = new BookItem(this._r.bind(this), this.mirror);
    book.url = `${this.mirror}/book/${id}`;
    await book.fetch(); // Ensure fetch is awaited to populate downloadUrls
    return book;
  }

  /**
   * Perform a full-text search.
   * @param {string} q - The search query.
   * @param {boolean} [exact=false] - Exact match.
   * @param {boolean} [phrase=false] - Search as a phrase.
   * @param {boolean} [words=false] - Search for words.
   * @param {number|null} [fromYear=null] - Start year.
   * @param {number|null} [toYear=null] - End year.
   * @param {string[]} [lang=[]] - List of languages.
   * @param {string[]} [extensions=[]] - List of extensions.
   * @param {number} [count=10] - Number of results per page.
   * @returns {Promise<SearchPaginator>} The paginator.
   * @throws {NoProfileError} If not logged in.
   * @throws {EmptyQueryError} If query is empty.
   * @throws {Error} If neither 'phrase' nor 'words' is specified.
   */
  async fullTextSearch(
    q = "",
    exact = false,
    phrase = false,
    words = false,
    fromYear = null,
    toYear = null,
    lang = [],
    extensions = [],
    count = 10
  ) {
    if (!this.profile) throw new NoProfileError();
    if (!q) throw new EmptyQueryError();
    if (!phrase && !words)
      throw new Error(
        "You should either specify 'words=true' to match words, or 'phrase=true' to match phrase."
      );

    let payload = `${this.mirror}/fulltext/${encodeURIComponent(q)}?`;

    if (phrase) {
      const check = q.trim().split(" ");
      if (check.length < 2)
        throw new Error(
          "At least 2 words must be provided for phrase search. Use 'words=true' to match a single word."
        );
      payload += "&type=phrase";
    } else {
      payload += "&type=words";
    }

    if (exact) payload += "&e=1";
    if (fromYear) payload += `&yearFrom=${fromYear}`;
    if (toYear) payload += `&yearTo=${toYear}`;

    if (lang && Array.isArray(lang)) {
      lang.forEach((l) => {
        payload += `&languages%5B%5D=${encodeURIComponent(
          typeof l === "string" ? l : l.value
        )}`;
      });
    }

    if (extensions && Array.isArray(extensions)) {
      extensions.forEach((ext) => {
        payload += `&extensions%5B%5D=${encodeURIComponent(
          typeof ext === "string" ? ext : ext.value
        )}`;
      });
    }

    const paginator = new SearchPaginator(
      payload,
      count,
      this._r.bind(this),
      this.mirror
    );
    await paginator.init();
    return paginator;
  }
}

module.exports = AsyncZlib;
