// src/booklists.js

const { BooklistPaginator } = require("./abstract");
const { OrderOptions } = require("./const");

class Booklists {
  constructor(request, cookies, mirror) {
    this.__r = request;
    this.cookies = cookies;
    this.mirror = mirror;
  }

  async searchPublic(q = "", count = 10, order = "") {
    const orderValue = order ? OrderOptions[order.toUpperCase()] || "" : "";
    const url = `${this.mirror}/booklists?searchQuery=${encodeURIComponent(
      q
    )}&order=${orderValue}`;
    const paginator = new BooklistPaginator(url, count, this.__r, this.mirror);
    return await paginator.init();
  }

  async searchPrivate(q = "", count = 10, order = "") {
    const orderValue = order ? OrderOptions[order.toUpperCase()] || "" : "";
    const url = `${this.mirror}/booklists/my?searchQuery=${encodeURIComponent(
      q
    )}&order=${orderValue}`;
    const paginator = new BooklistPaginator(url, count, this.__r, this.mirror);
    return await paginator.init();
  }
}

module.exports = {
  Booklists,
};
