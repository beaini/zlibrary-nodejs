// src/libasync.js

const { GET_request, POST_request, HEAD_request } = require("./util");
const {
  EmptyQueryError,
  ProxyNotMatchError,
  NoProfileError,
  NoDomainError,
  NoIdError,
} = require("./exception");
const logger = require("./logger");
const ZlibProfile = require("./profile");
const { SearchPaginator } = require("./abstract");
const BookItem = require("./bookItem");
const { Extension, Language } = require("./const");

const ZLIB_DOMAIN = "https://z-library.do";
const LOGIN_DOMAIN = "https://z-library.do/rpc.php";

const ZLIB_TOR_DOMAIN =
  "http://bookszlibb74ugqojhzhg2a63w5i2atv5bqarulgczawnbmsb6s6qead.onion";
const LOGIN_TOR_DOMAIN =
  "http://loginzlib2vrak5zzpcocc3ouizykn6k5qecgj2tzlnab5wcbqhembyd.onion/rpc.php";

class AsyncZlib {
  constructor(onion = false, proxyList = [], disableSemaphore = false) {
    if (proxyList && !Array.isArray(proxyList)) {
      throw new ProxyNotMatchError();
    }

    this.semaphore = !disableSemaphore;
    this.onion = onion;
    this.proxyList = proxyList;

    if (onion) {
      this.loginDomain = LOGIN_TOR_DOMAIN;
      this.domain = ZLIB_TOR_DOMAIN;
      this.mirror = this.domain;

      if (!proxyList || proxyList.length === 0) {
        console.error(
          "Tor proxy must be set to route through onion domains.\nSet up a tor service and use: onion=true, proxyList=['socks5://127.0.0.1:9050']"
        );
        process.exit(1);
      }
    } else {
      this.loginDomain = LOGIN_DOMAIN;
      this.domain = ZLIB_DOMAIN;
      this.mirror = ZLIB_DOMAIN;
    }

    this.cookies = null;
    this.profile = null;
  }

  async _r(url) {
    return await GET_request(url, this.cookies, this.proxyList);
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
      this.mirror = ZLIB_DOMAIN;
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

  async logout() {
    this.cookies = null;
    this.profile = null;
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
        payload += `&languages%5B%5D=${typeof l === "string" ? l : l.value}`;
      });
    }

    if (extensions && Array.isArray(extensions)) {
      extensions.forEach((ext) => {
        payload += `&extensions%5B%5D=${
          typeof ext === "string" ? ext : ext.value
        }`;
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

  async getById(id = "") {
    if (!id) throw new NoIdError();

    const book = new BookItem(this._r.bind(this), this.mirror);
    book.url = `${this.mirror}/book/${id}`;
    return await book.fetch();
  }

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
        payload += `&languages%5B%5D=${typeof l === "string" ? l : l.value}`;
      });
    }

    if (extensions && Array.isArray(extensions)) {
      extensions.forEach((ext) => {
        payload += `&extensions%5B%5D=${
          typeof ext === "string" ? ext : ext.value
        }`;
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
