// src/bookItem.js

const axios = require("axios");
const { JSDOM } = require("jsdom");
const logger = require("./logger");
const { ParseError } = require("./exception");
const config = require("./config");
const { getAxiosInstance } = require("./axiosInstance");

/**
 * Class representing a book item.
 */
class BookItem {
  /**
   * Create a BookItem instance.
   * @param {Function} request - The request function.
   * @param {string} mirror - The mirror URL.
   */
  constructor(request, mirror, cookies = {}) {
    this.__r = request;
    this.mirror = mirror || "https://z-library.do"; // Default domain if not provided
    this.url = "";
    this.name = "";
    this.authors = [];
    this.cover = "";
    this.description = "";
    this.year = "";
    this.edition = "";
    this.publisher = "";
    this.language = "";
    this.id = "";
    this.downloadUrls = [];
    this.cookies = cookies; // Assign passed cookies
    // Add other properties as needed
  }

  /**
   * Fetches the book details and download URLs.
   * @returns {Promise<BookItem>} The BookItem instance with populated details.
   * @throws {ParseError} If parsing fails.
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

    // Assign properties directly to the instance
    this.url = this.url;

    const nameElem = document.querySelector('h1[itemprop="name"]');
    this.name = nameElem ? nameElem.textContent.trim() : "";

    const authorsElems = document.querySelectorAll('a[itemprop="author"]');
    this.authors = [];
    authorsElems.forEach((an) => {
      this.authors.push({
        author: an.textContent.trim(),
        author_url: `${this.mirror}${encodeURI(an.getAttribute("href"))}`,
      });
    });

    const coverAnchor = wrap.querySelector("a.details-book-cover");
    this.cover = coverAnchor ? coverAnchor.getAttribute("href") : "";

    const descElem = wrap.querySelector("#bookDescriptionBox");
    this.description = descElem ? descElem.textContent.trim() : "";

    const details = wrap.querySelector(".bookDetailsBox");
    const properties = ["year", "edition", "publisher", "language"];
    properties.forEach((prop) => {
      const propElem = details.querySelector(
        `.property_${prop} .property_value`
      );
      if (propElem) {
        this[prop] = propElem.textContent.trim();
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
      this[label] = value;
    });

    const categoriesElem = details.querySelector(
      ".property_categories .property_value"
    );
    if (categoriesElem) {
      this.categories = categoriesElem.textContent.trim();
      const link = categoriesElem.querySelector("a");
      if (link) {
        this.categories_url = `${this.mirror}${link.getAttribute("href")}`;
      }
    }

    const fileElem = details.querySelector(".property__file");
    const fileText = fileElem ? fileElem.textContent.trim().split(",") : [];
    if (fileText.length >= 2) {
      this.extension = fileText[0].split("\n")[1].trim();
      this.size = fileText[1].trim();
    }

    const ratingElem = wrap.querySelector(".book-rating");
    if (ratingElem) {
      this.rating = ratingElem.textContent.replace(/\s+/g, "").trim();
    }

    // Fetch download URLs using the new API
    const bookId = this.extractBookId();
    if (bookId) {
      this.id = bookId;
      this.downloadUrls = await this.getDownloadUrls(bookId);
    } else {
      logger.warn("Book ID not found. Cannot fetch download URLs.");
      this.downloadUrls = [];
    }

    // Return the instance itself
    return this;
  }

  /**
   * Extracts the book ID from the URL.
   * @returns {string|null} The book ID or null if not found.
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
   * @returns {Promise<Array>} - Array of download URLs.
   */
  async getDownloadUrls(bookId) {
    const apiUrl = `${this.mirror}/papi/book/${bookId}/formats`;
    try {
      logger.info(`Fetching download formats from ${apiUrl}`);
      const response = await this.__r(apiUrl);

      // Assuming response is a JSON string.
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
          url: `${this.mirror}/${href}`,
        };
      });

      logger.info(`Found ${downloadUrls.length} download formats.`);
      return downloadUrls;
    } catch (error) {
      logger.error(`Failed to fetch download URLs: ${error.message}`);
      return [];
    }
  }
  /**
   * Fetches the book details and download URLs.
   * @returns {Promise<BookItem>} The BookItem instance with populated details.
   * @throws {ParseError} If parsing fails.
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

    // Assign properties directly to the instance
    this.url = this.url;

    const nameElem = document.querySelector('h1[itemprop="name"]');
    this.name = nameElem ? nameElem.textContent.trim() : "";

    const authorsElems = document.querySelectorAll('a[itemprop="author"]');
    this.authors = [];
    authorsElems.forEach((an) => {
      this.authors.push({
        author: an.textContent.trim(),
        author_url: `${this.mirror}${encodeURI(an.getAttribute("href"))}`,
      });
    });

    const coverAnchor = wrap.querySelector("a.details-book-cover");
    this.cover = coverAnchor ? coverAnchor.getAttribute("href") : "";

    const descElem = wrap.querySelector("#bookDescriptionBox");
    this.description = descElem ? descElem.textContent.trim() : "";

    const details = wrap.querySelector(".bookDetailsBox");
    const properties = ["year", "edition", "publisher", "language"];
    properties.forEach((prop) => {
      const propElem = details.querySelector(
        `.property_${prop} .property_value`
      );
      if (propElem) {
        this[prop] = propElem.textContent.trim();
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
      this[label] = value;
    });

    const categoriesElem = details.querySelector(
      ".property_categories .property_value"
    );
    if (categoriesElem) {
      this.categories = categoriesElem.textContent.trim();
      const link = categoriesElem.querySelector("a");
      if (link) {
        this.categories_url = `${this.mirror}${link.getAttribute("href")}`;
      }
    }

    const fileElem = details.querySelector(".property__file");
    const fileText = fileElem ? fileElem.textContent.trim().split(",") : [];
    if (fileText.length >= 2) {
      this.extension = fileText[0].split("\n")[1].trim();
      this.size = fileText[1].trim();
    }

    const ratingElem = wrap.querySelector(".book-rating");
    if (ratingElem) {
      this.rating = ratingElem.textContent.replace(/\s+/g, "").trim();
    }

    // Fetch download URLs using the new API
    const bookId = this.extractBookId();
    if (bookId) {
      this.id = bookId;
      this.downloadUrls = await this.getDownloadUrls(bookId);
    } else {
      logger.warn("Book ID not found. Cannot fetch download URLs.");
      this.downloadUrls = [];
    }

    // Return the instance itself
    return this;
  }

  /**
   * Extracts the book ID from the URL.
   * @returns {string|null} The book ID or null if not found.
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
   * @returns {Promise<Array>} - Array of download URLs.
   */
  async getDownloadUrls(bookId) {
    const apiUrl = `${this.mirror}/papi/book/${bookId}/formats`;
    try {
      logger.info(`Fetching download formats from ${apiUrl}`);
      const response = await this.__r(apiUrl);

      // Assuming response is a JSON string.
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
          url: `${this.mirror}/${href}`,
        };
      });

      logger.info(`Found ${downloadUrls.length} download formats.`);
      return downloadUrls;
    } catch (error) {
      logger.error(`Failed to fetch download URLs: ${error.message}`);
      return [];
    }
  }

  /**
   * Downloads the book in the specified format and returns binary data.
   * @param {string} extension - The desired file extension (e.g., 'PDF', 'EPUB').
   * @returns {Promise<Buffer>} - Resolves to the binary data of the downloaded file.
   * @throws {Error} - If the specified format is not available or download fails.
   */
  async download(extension) {
    // Validate download URLs availability
    if (!this.downloadUrls || this.downloadUrls.length === 0) {
      const errorMsg = "No download URLs available for this book.";
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Find the download URL matching the desired extension
    const format = this.downloadUrls.find(
      (f) => f.extension.toUpperCase() === extension.toUpperCase()
    );

    if (!format) {
      const errorMsg = `Extension "${extension}" is not available for this book.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    const downloadUrl = format.url;

    logger.info(`Starting download for format: ${extension}`);

    // Define maximum number of retries for transient errors
    const MAX_RETRIES = 3;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      try {
        const axiosInstance = getAxiosInstance(); // Get the shared Axios instance
        const response = await axiosInstance.get(downloadUrl, {
          responseType: "arraybuffer", // Ensures binary data is returned
          headers: {
            "User-Agent": "Mozilla/5.0", // Some servers require a User-Agent header
          },
          timeout: 30000, // 30 seconds timeout; adjust as needed
          maxRedirects: 5, // Handle up to 5 redirects
          validateStatus: function (status) {
            return status >= 200 && status < 400; // Resolve only if the status code is less than 400
          },
        });

        // Check for successful response
        if (response.status !== 200) {
          const errorMsg = `Failed to download file. HTTP Status Code: ${response.status}`;
          logger.error(errorMsg);
          throw new Error(errorMsg);
        }

        // Optional: Validate Content-Type
        const mimeTypes = {
          PDF: "application/pdf",
          EPUB: "application/epub+zip",
          MOBI: "application/x-mobipocket-ebook",
          // Add other mappings as needed
        };
        const expectedContentType = mimeTypes[extension.toUpperCase()];
        const contentType = response.headers["content-type"];

        if (expectedContentType && !contentType.includes(expectedContentType)) {
          const errorMsg = `Unexpected content type: ${contentType}. Expected: ${expectedContentType}`;
          logger.error(errorMsg);
          throw new Error(errorMsg);
        }

        logger.info(`Download completed for format: ${extension}`);

        return Buffer.from(response.data);
      } catch (error) {
        attempt += 1;
        const isRetryable = this.isRetryableError(error);

        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = this.getExponentialBackoffDelay(attempt);
          logger.warn(
            `Attempt ${attempt} failed. Retrying in ${
              delay / 1000
            } seconds... Error: ${error.message}`
          );
          await this.delay(delay);
        } else {
          const finalErrorMsg = `Failed to download file after ${attempt} attempts. Error: ${error.message}`;
          logger.error(finalErrorMsg);
          throw new Error(finalErrorMsg);
        }
      }
    }
  }

  /**
   * Determines if an error is retryable based on its type or status code.
   * @param {Error} error - The error thrown by Axios.
   * @returns {boolean} - True if the error is retryable, false otherwise.
   */
  isRetryableError(error) {
    if (error.code) {
      // Network or Axios specific errors
      const retryableCodes = [
        "ECONNABORTED",
        "ECONNRESET",
        "ENOTFOUND",
        "ETIMEDOUT",
        "EAI_AGAIN",
      ];
      if (retryableCodes.includes(error.code)) {
        return true;
      }
    }

    if (error.response) {
      // HTTP status codes 5xx are typically retryable
      if (error.response.status >= 500 && error.response.status < 600) {
        return true;
      }
    }

    // Default to not retryable
    return false;
  }

  /**
   * Calculates delay time using exponential backoff strategy.
   * @param {number} attempt - The current retry attempt number.
   * @returns {number} - Delay in milliseconds.
   */
  getExponentialBackoffDelay(attempt) {
    const baseDelay = 1000; // 1 second
    const maxDelay = 16000; // 16 seconds
    const delay = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay);
    return delay;
  }

  /**
   * Delays execution for a specified duration.
   * @param {number} ms - Duration in milliseconds.
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = BookItem;
