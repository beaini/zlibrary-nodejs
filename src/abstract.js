// src/abstract.js

const { JSDOM } = require("jsdom");
const logger = require("./logger");
const { ParseError } = require("./exception");
const BookItem = require("./bookItem");
const BooklistItemPaginator = require("./booklistItemPaginator");

/**
 * SearchPaginator handles pagination for search results.
 */
class SearchPaginator {
  constructor(url, count, request, mirror) {
    this.__url = url;
    this.__pos = 0;
    this.__r = request;
    this.mirror = mirror;
    this.page = 1;
    this.total = 0;
    this.count = count > 50 ? 50 : count <= 0 ? 1 : count;
    this.result = [];
    this.storage = {
      1: [],
    };
  }

  async init() {
    const pageContent = await this.fetchPage();
    this.parsePage(pageContent);
  }

  async fetchPage() {
    const url = `${this.__url}&page=${this.page}`;
    return await this.__r(url);
  }

  parsePage(page) {
    const dom = new JSDOM(page);
    const document = dom.window.document;
    const box = document.querySelector("#searchResultBox");

    if (!box) {
      throw new ParseError("Could not parse book list.");
    }

    const notFound = document.querySelector(".notFound");
    if (notFound) {
      logger.debug("Nothing found.");
      this.storage[this.page] = [];
      this.result = [];
      return;
    }

    const bookList = box.querySelectorAll(".resItemBox");
    if (!bookList.length) {
      throw new ParseError("Could not find the book list.");
    }

    this.storage[this.page] = [];

    bookList.forEach((bookElem, idx) => {
      const js = new BookItem(this.__r, this.mirror);

      const coverWrapper = bookElem.querySelector(".itemCoverWrapper");
      if (!coverWrapper) {
        logger.debug(`Failure to parse ${idx}-th book at url ${this.__url}`);
        return;
      }

      // Select the <z-cover> element within the cover wrapper
      const zcover = coverWrapper.querySelector("z-cover");
      if (!zcover) {
        logger.debug(
          `Failure to find <z-cover> in ${idx}-th book at url ${this.__url}`
        );
        return;
      }

      // Extract the 'id' and 'isbn' attributes from <z-cover>
      js.id = zcover.getAttribute("id");
      js.isbn = zcover.getAttribute("isbn");

      const bookUrlElem = zcover.querySelector("a");
      if (bookUrlElem) {
        js.url = `${this.mirror}${bookUrlElem.getAttribute("href")}`;
      }

      const img = zcover.querySelector("img");
      if (img) {
        js.cover = img.getAttribute("data-src") || img.getAttribute("src");
      }

      const dataTable = bookElem.querySelector("table");
      const nameAndBookmarks = dataTable.querySelector("h3");

      if (!nameAndBookmarks) {
        logger.debug("Error finding name and bookmarks h3 field.");
        throw new ParseError(
          `Could not parse ${idx}-th book at url ${this.__url}`
        );
      }

      const nameElem = nameAndBookmarks.querySelector("a");
      if (!nameElem) {
        logger.debug("Error finding name 'a' tag inside 'h3' field.");
        throw new ParseError(
          `Could not parse ${idx}-th book at url ${this.__url}`
        );
      }

      js.name = nameElem.textContent.trim();

      const publisherElem = dataTable.querySelector('a[title="Publisher"]');
      if (publisherElem) {
        js.publisher = publisherElem.textContent.trim();
        js.publisher_url = `${this.mirror}${publisherElem.getAttribute(
          "href"
        )}`;
      }

      const authorsElem = dataTable.querySelector(".authors");
      const authorLinks = authorsElem ? authorsElem.querySelectorAll("a") : [];

      js.authors = [];

      authorLinks.forEach((an) => {
        js.authors.push({
          author: an.textContent.trim(),
          author_url: `${this.mirror}${encodeURI(an.getAttribute("href"))}`,
        });
      });

      const yearElem = dataTable.querySelector(
        ".property_year .property_value"
      );
      if (yearElem) {
        js.year = yearElem.textContent.trim();
      }

      const langElem = dataTable.querySelector(
        ".property_language .property_value"
      );
      if (langElem) {
        js.language = langElem.textContent.trim();
      }

      const fileElem = dataTable.querySelector(".property__file");
      const fileText = fileElem ? fileElem.textContent.trim().split(",") : [];
      if (fileText.length >= 2) {
        js.extension = fileText[0].split("\n")[1].trim();
        js.size = fileText[1].trim();
      }

      const ratingElem = dataTable.querySelector(".property_rating");
      if (ratingElem) {
        js.rating = ratingElem.textContent.replace(/\s+/g, "").trim();
      }

      this.storage[this.page].push(js);
    });

    // Get total pages
    const scripts = Array.from(document.querySelectorAll("script"));
    scripts.forEach((script) => {
      const txt = script.textContent;
      if (txt.includes("var pagerOptions")) {
        const match = txt.match(/pagesTotal:\s*(\d+)/);
        if (match) {
          this.total = parseInt(match[1]);
        }
      }
    });
  }

  async next() {
    if (this.__pos >= this.storage[this.page].length) {
      await this.nextPage();
    }

    this.result = this.storage[this.page].slice(
      this.__pos,
      this.__pos + this.count
    );
    this.__pos += this.count;
    return this.result;
  }

  async prev() {
    this.__pos -= this.count;
    if (this.__pos < 0) {
      await this.prevPage();
    }

    const start = this.__pos - this.count;
    const end = this.__pos;

    this.result = this.storage[this.page].slice(start >= 0 ? start : 0, end);
    return this.result;
  }

  async nextPage() {
    if (this.page < this.total) {
      this.page += 1;
      this.__pos = 0;

      if (!this.storage[this.page]) {
        const pageContent = await this.fetchPage();
        this.parsePage(pageContent);
      }
    } else {
      this.__pos -= this.count;
      if (this.__pos < 0) {
        this.__pos = 0;
      }
    }
  }

  async prevPage() {
    if (this.page > 1) {
      this.page -= 1;

      if (!this.storage[this.page]) {
        const pageContent = await this.fetchPage();
        this.parsePage(pageContent);
      }

      this.__pos = this.storage[this.page].length;
    } else {
      this.__pos = 0;
    }
  }
}

/**
 * BooklistPaginator handles pagination for book lists.
 */
class BooklistPaginator {
  constructor(url, count, request, mirror) {
    this.__url = url;
    this.__pos = 0;
    this.__r = request;
    this.mirror = mirror;
    this.page = 1;
    this.total = 1;
    this.count = count > 50 ? 50 : count <= 0 ? 1 : count;
    this.result = [];
    this.storage = {
      1: [],
    };
  }

  async init() {
    const pageContent = await this.fetchPage();
    this.parsePage(pageContent);
    return this;
  }

  async fetchPage() {
    const url = `${this.__url}&page=${this.page}`;
    return await this.__r(url);
  }

  parsePage(page) {
    const dom = new JSDOM(page);
    const document = dom.window.document;

    const checkNotFound = document.querySelector(".cBox1");
    const LISTNOTFOUND = "On your request nothing has been found";
    if (
      checkNotFound &&
      checkNotFound.textContent.trim().includes(LISTNOTFOUND)
    ) {
      logger.debug("Nothing found.");
      this.storage[this.page] = [];
      this.result = [];
      return;
    }

    const bookList = document.querySelectorAll(".readlist-item");
    if (!bookList.length) {
      throw new ParseError("Could not find the booklists.");
    }

    this.storage[this.page] = [];

    bookList.forEach((bookElem, idx) => {
      const js = new BooklistItemPaginator(this.__r, this.mirror, this.count);

      const nameElem = bookElem.querySelector(".title");
      if (!nameElem) {
        throw new ParseError(
          `Could not parse ${idx}-th booklist at url ${this.__url}`
        );
      }
      js.name = nameElem.textContent.trim();

      const bookUrlElem = nameElem.querySelector("a");
      if (bookUrlElem) {
        js.url = `${this.mirror}${bookUrlElem.getAttribute("href")}`;
      }

      const infoWrap = bookElem.querySelector(".readlist-info");

      const authorElem = infoWrap.querySelector(".author");
      if (authorElem) {
        js.author = authorElem.textContent.trim();
      }

      const dateElem = infoWrap.querySelector(".date");
      if (dateElem) {
        js.date = dateElem.textContent.trim();
      }

      const countElem = infoWrap.querySelector(".books-count");
      if (countElem) {
        js.count = countElem.textContent.trim();
      }

      const viewsElem = infoWrap.querySelector(".views-count");
      if (viewsElem) {
        js.views = viewsElem.textContent.trim();
      }

      js.books_lazy = [];
      const carousel = bookElem.querySelector(".zlibrary-carousel");
      if (!carousel) {
        this.storage[this.page].push(js);
        return;
      }
      const covers = carousel.querySelectorAll(".carousel-cell-inner");

      covers.forEach((cover) => {
        const res = new BookItem(this.__r, this.mirror);
        const anchor = cover.querySelector("a");
        if (anchor) {
          res.url = `${this.mirror}${anchor.getAttribute("href")}`;
        }
        res.name = "";

        const check = cover.querySelector(".checkBookDownloaded");
        res.id = check.getAttribute("data-book_id");

        const img = check.querySelector("img");
        res.cover =
          img.getAttribute("data-flickity-lazyload") ||
          img.getAttribute("data-src");

        js.books_lazy.push(res);
      });

      this.storage[this.page].push(js);
    });

    // Get total pages
    const scripts = Array.from(document.querySelectorAll("script"));
    scripts.forEach((script) => {
      const txt = script.textContent;
      if (txt.includes("var pagerOptions")) {
        const match = txt.match(/pagesTotal:\s*(\d+)/);
        if (match) {
          this.total = parseInt(match[1]);
        }
      }
    });
  }

  async next() {
    if (this.__pos >= this.storage[this.page].length) {
      await this.nextPage();
    }

    this.result = this.storage[this.page].slice(
      this.__pos,
      this.__pos + this.count
    );
    this.__pos += this.count;
    return this.result;
  }

  async prev() {
    this.__pos -= this.count;
    if (this.__pos < 0) {
      await this.prevPage();
    }

    const start = this.__pos - this.count;
    const end = this.__pos;

    this.result = this.storage[this.page].slice(start >= 0 ? start : 0, end);
    return this.result;
  }

  async nextPage() {
    if (this.page < this.total) {
      this.page += 1;
      this.__pos = 0;

      if (!this.storage[this.page]) {
        const pageContent = await this.fetchPage();
        this.parsePage(pageContent);
      }
    } else {
      this.__pos -= this.count;
      if (this.__pos < 0) {
        this.__pos = 0;
      }
    }
  }

  async prevPage() {
    if (this.page > 1) {
      this.page -= 1;

      if (!this.storage[this.page]) {
        const pageContent = await this.fetchPage();
        this.parsePage(pageContent);
      }

      this.__pos = this.storage[this.page].length;
    } else {
      this.__pos = 0;
    }
  }
}

/**
 * DownloadsPaginator handles pagination for download histories.
 */
class DownloadsPaginator {
  constructor(url, count, request, mirror) {
    this.__url = url;
    this.__pos = 0;
    this.__r = request;
    this.mirror = mirror;
    this.page = 1;
    this.total = 1;
    this.count = count > 50 ? 50 : count <= 0 ? 1 : count;
    this.result = [];
    this.storage = {
      1: [],
    };
  }

  async init() {
    const pageContent = await this.fetchPage();
    this.parsePage(pageContent);
    return this;
  }

  async fetchPage() {
    const url = `${this.__url}&page=${this.page}`;
    return await this.__r(url);
  }

  parsePage(page) {
    const dom = new JSDOM(page);
    const document = dom.window.document;
    const box = document.querySelector(".dstats-content");

    if (!box) {
      throw new ParseError("Could not parse downloads list.");
    }

    const checkNotFound = box.querySelector("p");
    const DLNOTFOUND = "Downloads not found";
    if (
      checkNotFound &&
      checkNotFound.textContent.trim().includes(DLNOTFOUND)
    ) {
      logger.debug("This page is empty.");
      this.storage[this.page] = [];
      this.result = [];
      return;
    }

    const bookList = box.querySelectorAll("tr.dstats-row");
    if (!bookList.length) {
      throw new ParseError("Could not find the book list.");
    }

    this.storage[this.page] = [];

    bookList.forEach((bookElem, idx) => {
      const js = new BookItem(this.__r, this.mirror);

      const titleElem = bookElem.querySelector(".book-title");
      const dateElem = bookElem.querySelector("td.lg-w-120");

      if (titleElem) {
        js.name = titleElem.textContent.trim();
      }

      if (dateElem) {
        js.date = dateElem.textContent.trim();
      }

      const bookUrlElem = bookElem.querySelector("a");
      if (bookUrlElem) {
        js.url = `${this.mirror}${bookUrlElem.getAttribute("href")}`;
      }

      this.storage[this.page].push(js);
    });

    // Assuming total pages is always 1 for downloads, adjust if necessary
    // If there's a pager, implement similar logic as in SearchPaginator
    this.total = 1; // Update this if pagination is supported
  }

  async next() {
    if (this.__pos >= this.storage[this.page].length) {
      await this.nextPage();
    }

    this.result = this.storage[this.page].slice(
      this.__pos,
      this.__pos + this.count
    );
    this.__pos += this.count;
    return this.result;
  }

  async prev() {
    this.__pos -= this.count;
    if (this.__pos < 0) {
      await this.prevPage();
    }

    const start = this.__pos - this.count;
    const end = this.__pos;

    this.result = this.storage[this.page].slice(start >= 0 ? start : 0, end);
    return this.result;
  }

  async nextPage() {
    if (this.page < this.total) {
      this.page += 1;
      this.__pos = 0;

      if (!this.storage[this.page]) {
        const pageContent = await this.fetchPage();
        this.parsePage(pageContent);
      }
    } else {
      this.__pos -= this.count;
      if (this.__pos < 0) {
        this.__pos = 0;
      }
    }
  }

  async prevPage() {
    if (this.page > 1) {
      this.page -= 1;

      if (!this.storage[this.page]) {
        const pageContent = await this.fetchPage();
        this.parsePage(pageContent);
      }

      this.__pos = this.storage[this.page].length;
    } else {
      this.__pos = 0;
    }
  }
}

module.exports = {
  SearchPaginator,
  BooklistPaginator,
  DownloadsPaginator,
};
