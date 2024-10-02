// src/bookItem.js

const { JSDOM } = require("jsdom");
const logger = require("./logger");
const { ParseError } = require("./exception");
const config = require("./config"); // Import centralized config

class BookItem {
  constructor(request, mirror) {
    this.__r = request;
    this.mirror = mirror || config.ZLIB_DOMAIN; // Default to config if mirror not provided
    this.parsed = null;
    this.url = "";
    this.name = "";
    this.authors = [];
    this.downloadUrls = [];
  }

  /**
   * Fetches the book details and download URLs.
   */
  async fetch() {
    if (!this.url) {
      throw new ParseError("Book URL is not set.");
    }

    const page = await this.__r(this.url);
    const dom = new JSDOM(page);
    const document = dom.window.document;

    const wrap = document.querySelector(".row.cardBooks");
    if (!wrap) {
      throw new ParseError(`Failed to parse ${this.url}`);
    }

    const parsed = {};
    parsed.url = this.url;

    const nameElem = document.querySelector('h1[itemprop="name"]');
    parsed.name = nameElem ? nameElem.textContent.trim() : "";

    const authorsElems = document.querySelectorAll('a[itemprop="author"]');
    parsed.authors = [];
    authorsElems.forEach((an) => {
      parsed.authors.push({
        author: an.textContent.trim(),
        author_url: `${this.mirror}${encodeURI(an.getAttribute("href"))}`,
      });
    });

    const coverAnchor = wrap.querySelector("a.details-book-cover");
    if (coverAnchor) {
      parsed.cover = coverAnchor.getAttribute("href");
    }

    const descElem = wrap.querySelector("#bookDescriptionBox");
    if (descElem) {
      parsed.description = descElem.textContent.trim();
    }

    const details = wrap.querySelector(".bookDetailsBox");
    const properties = ["year", "edition", "publisher", "language"];
    properties.forEach((prop) => {
      const propElem = details.querySelector(
        `.property_${prop} .property_value`
      );
      if (propElem) {
        parsed[prop] = propElem.textContent.trim();
      }
    });

    const isbns = details.querySelectorAll(".property_isbn");
    isbns.forEach((isbnElem) => {
      const label = isbnElem
        .querySelector(".property_label")
        .textContent.trim()
        .replace(":", "");
      const value = isbnElem
        .querySelector(".property_value")
        .textContent.trim();
      parsed[label] = value;
    });

    const categoriesElem = details.querySelector(
      ".property_categories .property_value"
    );
    if (categoriesElem) {
      parsed.categories = categoriesElem.textContent.trim();
      const link = categoriesElem.querySelector("a");
      if (link) {
        parsed.categories_url = `${this.mirror}${link.getAttribute("href")}`;
      }
    }

    const fileElem = details.querySelector(".property__file");
    const fileText = fileElem ? fileElem.textContent.trim().split(",") : [];
    if (fileText.length >= 2) {
      parsed.extension = fileText[0].split("\n")[1].trim();
      parsed.size = fileText[1].trim();
    }

    const ratingElem = wrap.querySelector(".book-rating");
    if (ratingElem) {
      parsed.rating = ratingElem.textContent.replace(/\s+/g, "").trim();
    }

    // Fetch download URLs using the new API
    const bookId = this.extractBookId();
    if (bookId) {
      const downloadUrls = await this.getDownloadUrls(bookId);
      parsed.downloadUrls = downloadUrls;
    } else {
      logger.warn("Book ID not found. Cannot fetch download URLs.");
      parsed.downloadUrls = [];
    }

    this.parsed = parsed;
    return parsed;
  }

  /**
   * Extracts the book ID from the URL.
   */
  extractBookId() {
    try {
      const urlObj = new URL(this.url);
      const pathSegments = urlObj.pathname
        .split("/")
        .filter((segment) => segment);
      const bookIndex = pathSegments.indexOf("book");
      if (bookIndex !== -1 && pathSegments.length > bookIndex + 1) {
        const bookId = pathSegments[bookIndex + 1];
        logger.debug(`Extracted book ID: ${bookId}`);
        return bookId;
      } else {
        logger.error("Book ID not found in URL.");
        return null;
      }
    } catch (error) {
      logger.error("Failed to extract book ID from URL.");
      return null;
    }
  }

  /**
   * Fetches available download formats and constructs download URLs.
   * @param {string} bookId - The ID of the book.
   * @returns {Array} - Array of download URLs.
   */
  async getDownloadUrls(bookId) {
    const apiUrl = `https://z-library.do/papi/book/${bookId}/formats`;
    try {
      logger.info(`Fetching download formats from ${apiUrl}`);
      const response = await this.__r(apiUrl);

      // Assuming response is a JSON string. If it's already parsed, skip JSON.parse
      let data;
      if (typeof response === "string") {
        data = JSON.parse(response);
      } else {
        data = response;
      }

      if (data.success !== 1 || !data.books || !Array.isArray(data.books)) {
        throw new ParseError("Invalid response structure from formats API.");
      }

      const downloadUrls = data.books.map((format) => {
        // Ensure href does not have leading slash
        const href = format.href.startsWith("/")
          ? format.href.slice(1)
          : format.href;
        return {
          id: format.id,
          extension: format.extension,
          filesize: format.filesizeString,
          url: `https://z-library.do${href}`,
        };
      });

      logger.info(`Found ${downloadUrls.length} download formats.`);
      return downloadUrls;
    } catch (error) {
      logger.error(`Failed to fetch download URLs: ${error.message}`);
      return [];
    }
  }
}

module.exports = BookItem;
