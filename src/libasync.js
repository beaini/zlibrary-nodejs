// src/libasync.js

const { GET_request, POST_request } = require("./util");
const {
  NoDomainError,
  EmptyQueryError,
  NoProfileError,
  NoIdError,
} = require("./exception");
const { createAxiosInstance, updateCookies } = require("./axiosInstance");
const ZlibProfile = require("./profile");
const SearchPaginator = require("./abstract").SearchPaginator;
const BookItem = require("./bookItem");
const logger = require("./logger");
const config = require("./config"); // Import centralized config

class AsyncZlib {
  constructor(options = {}) {
    this.proxyList = options.proxyList || [];
    this.cookies = {}; // Initialize cookies as an empty object
    this.domains = options.customDomains || require("./config");
    this.onion = options.onion || false;

    // Set the appropriate domains based on whether Tor is used
    this.domain = this.onion
      ? this.domains.ZLIB_TOR_DOMAIN
      : this.domains.ZLIB_DOMAIN;
    this.loginDomain = this.onion
      ? this.domains.LOGIN_TOR_DOMAIN
      : this.domains.LOGIN_DOMAIN;
    this.mirror = this.domain;
    this.bookIdToUrlMap = {};
    // Create the shared Axios instance with initial cookies and proxy settings
    createAxiosInstance(this.proxyList, this.cookies);
  }

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

    const [resp, setCookies] = await POST_request(this.loginDomain, data);

    // Process response and set cookies
    setCookies.forEach((cookieStr) => {
      const [cookiePair] = cookieStr.split(";");
      const [key, value] = cookiePair.split("=");
      this.cookies[key.trim()] = value.trim();
    });

    // Update the shared Axios instance with the new cookies
    updateCookies(this.cookies);

    logger.debug(`Set cookies: ${JSON.stringify(this.cookies)}`);

    if (this.onion) {
      const url = `${this.domain}/?remix_userkey=${this.cookies["remix_userkey"]}&remix_userid=${this.cookies["remix_userid"]}`;
      const [_, moreCookies] = await GET_request(url);

      moreCookies.forEach((cookieStr) => {
        const [cookiePair] = cookieStr.split(";");
        const [key, value] = cookiePair.split("=");
        this.cookies[key.trim()] = value.trim();
      });

      // Update the shared Axios instance with the new cookies
      updateCookies(this.cookies);

      logger.debug(`Updated cookies: ${JSON.stringify(this.cookies)}`);
      logger.info(`Set working mirror: ${this.mirror}`);
    } else {
      this.mirror = this.domains.ZLIB_DOMAIN;

      if (!this.mirror) {
        throw new NoDomainError();
      }
    }

    this.profile = new ZlibProfile(this.cookies, this.mirror, this.domain);
    return this.profile;
  }

  // Add the _r method
  async _r(url, expectJson = false) {
    try {
      const response = await GET_request(url, expectJson);
      return response;
    } catch (error) {
      throw error;
    }
  }

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
   * Get a book by its ID using the /papi/book/:id/formats endpoint.
   * @param {string} id - The book ID.
   * @returns {Promise<BookItem>} The book item.
   * @throws {NoIdError} If ID is not provided.
   */
  async getById(id = "") {
    if (!id) throw new NoIdError();

    let bookUrl = this.bookIdToUrlMap[id];
    if (!bookUrl) {
      logger.warn(
        `URL for book ID ${id} not found in cache. Attempting to fetch via API.`
      );

      // Attempt to fetch book details via /papi/book/:id/formats
      const formatsUrl = `${this.mirror}/papi/book/${id}/formats`;
      let formatsData;
      try {
        formatsData = await this._r(formatsUrl, true);
      } catch (error) {
        logger.error(
          `Failed to fetch formats for book ID ${id}: ${error.message}`
        );
        throw error;
      }

      if (
        !formatsData.success ||
        !formatsData.books ||
        !Array.isArray(formatsData.books)
      ) {
        throw new ParseError("Invalid response structure from formats API.");
      }

      // Create a new BookItem instance
      const book = new BookItem(this._r.bind(this), this.mirror);
      book.id = id;
      book.downloadUrls = formatsData.books.map((format) => ({
        id: format.id,
        extension: format.extension,
        filesize: format.filesizeString,
        url: `${this.mirror}/${
          format.href.startsWith("/") ? format.href.slice(1) : format.href
        }`,
      }));

      // Optionally, set other properties if available
      // book.name = formatsData.title || "";
      // book.authors = formatsData.authors || [];

      return book;
    }

    const book = new BookItem(this._r.bind(this), this.mirror);
    book.url = bookUrl;
    await book.fetch(); // This should work as the URL is correct
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
