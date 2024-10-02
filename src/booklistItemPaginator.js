// src/booklistItemPaginator.js

const { JSDOM } = require("jsdom");
const BookItem = require("./bookItem");
const { ParseError } = require("./exception");
const logger = require("./logger");

class BooklistItemPaginator extends BookItem {
  constructor(request, mirror, count = 10) {
    super(request, mirror);
    this.parsed = null;
    this.count = count;
    this.__url = "";
    this.page = 1;
    this.total = 1;
    this.result = [];
    this.storage = {
      1: [],
    };
  }

  async fetch() {
    const parsed = {};
    parsed.url = this.url;
    parsed.name = this.name;

    // Extract the booklist ID from the URL
    const urlParts = this.url.split("/");
    const getId = urlParts[urlParts.length - 2]; // Assuming URL ends with /{id}/something
    const payload = `papi/booklist/${getId}/get-books`;
    this.__url = `${this.mirror}/${payload}`;

    await this.init();

    this.parsed = parsed;
    return this.parsed;
  }

  async init() {
    const json = await this.fetchJson();
    await this.parseJson(json);
    return this;
  }

  async fetchJson() {
    const url = `${this.__url}/${this.page}`;
    return await this.__r(url);
  }

  async parseJson(jsonStr) {
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (error) {
      throw new ParseError("Failed to parse JSON response.");
    }

    this.storage[this.page] = [];

    if (!data.books || !Array.isArray(data.books)) {
      throw new ParseError("Invalid JSON structure for books.");
    }

    data.books.forEach((book) => {
      const js = new BookItem(this.__r, this.mirror);

      js.id = book.book.id;
      js.isbn = book.book.identifier;

      const bookUrl = book.book.href;
      if (bookUrl) {
        js.url = `${this.mirror}${bookUrl}`;
      }

      js.cover = book.book.cover;
      js.name = book.book.title;

      js.publisher = book.book.publisher;

      // Assuming 'author' is a string; adjust if it's an object
      if (book.book.author) {
        js.authors = book.book.author.split(",").map((authorName) => ({
          author: authorName.trim(),
          author_url: `${this.mirror}${encodeURI(authorName.href)}`, // Adjust if authorName is an object
        }));
      } else {
        js.authors = [];
      }

      js.year = book.book.year;
      js.language = book.book.language;

      js.extension = book.book.extension;
      js.size = book.book.filesizeString;

      js.rating = book.book.qualityScore;

      this.storage[this.page].push(js);
    });

    // Update total pages from the response
    if (data.pagination && data.pagination.total_pages) {
      this.total = parseInt(data.pagination.total_pages);
    } else {
      this.total = 1; // Default to 1 if not provided
    }
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
        const json = await this.fetchJson();
        await this.parseJson(json);
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
        const json = await this.fetchJson();
        await this.parseJson(json);
      }

      this.__pos = this.storage[this.page].length;
    } else {
      this.__pos = 0;
    }
  }
}

module.exports = BooklistItemPaginator;
