// src/bookItem.js

const { JSDOM } = require("jsdom");
const logger = require("./logger");
const { ParseError } = require("./exception");

class BookItem {
  constructor(request, mirror) {
    this.__r = request;
    this.mirror = mirror;
    this.parsed = null;
    this.url = "";
    this.name = "";
    this.authors = [];
    // Initialize other properties as needed
  }

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

    const downloadButton = wrap.querySelector(".addDownloadedBook .premiumBtn");

    if (downloadButton) {
      // Print the HTML content inside the selected element
      logger.info(downloadButton.innerHTML);

      // OR, if you want to print the full element including itself
      logger.info(downloadButton.outerHTML);
    } else {
      logger.warn("Download button not found.");
    }
    if (downloadButton) {
      const downloadText = downloadButton.textContent.trim();
      if (downloadText.includes("unavailable")) {
        parsed.download_url = "Unavailable (use tor to download)";
      } else {
        parsed.download_url = `${this.mirror}${downloadButton.getAttribute(
          "href"
        )}`;
      }
    } else {
      throw new ParseError("Could not parse the download link.");
    }

    this.parsed = parsed;
    return parsed;
  }
}

module.exports = BookItem;
