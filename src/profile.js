// src/profile.js

const { JSDOM } = require("jsdom");
const { ParseError } = require("./exception");
const logger = require("./logger");
const { DownloadsPaginator } = require("./abstract");
const { Booklists } = require("./booklists");
const { OrderOptions } = require("./const");

class ZlibProfile {
  constructor(request, cookies, mirror, domain) {
    this.__r = request;
    this.cookies = cookies;
    this.mirror = mirror;
    this.domain = domain;
  }

  async getLimits() {
    const resp = await this.__r(`${this.mirror}/users/downloads`);
    const dom = new JSDOM(resp);
    const document = dom.window.document;

    const dstats = document.querySelector(".dstats-info");
    if (!dstats) {
      throw new ParseError(
        `Could not parse download limit at url: ${this.mirror}/users/downloads`
      );
    }

    const dlInfo = dstats.querySelector(".d-count");
    if (!dlInfo) {
      throw new ParseError(
        `Could not parse download limit info at url: ${this.mirror}/users/downloads`
      );
    }

    const [dailyStr, allowedStr] = dlInfo.textContent.trim().split("/");
    const daily = parseInt(dailyStr);
    const allowed = parseInt(allowedStr);

    const dlResetElem = dstats.querySelector(".d-reset");
    const dlReset = dlResetElem ? dlResetElem.textContent.trim() : "";

    return {
      daily_amount: daily,
      daily_allowed: allowed,
      daily_remaining: allowed - daily,
      daily_reset: dlReset,
    };
  }

  async downloadHistory(page = 1, dateFrom = null, dateTo = null) {
    // You can implement date filtering if needed
    const dFrom = dateFrom ? dateFrom.toISOString().split("T")[0] : "";
    const dTo = dateTo ? dateTo.toISOString().split("T")[0] : "";
    const url = `${this.mirror}/users/dstats.php?date_from=${dFrom}&date_to=${dTo}`;

    const paginator = new DownloadsPaginator(url, page, this.__r, this.mirror);
    return await paginator.init();
  }

  async searchPublicBooklists(q = "", count = 10, order = "") {
    if (order && !Object.values(OrderOptions).includes(order)) {
      throw new Error("Invalid order option");
    }

    const paginator = new Booklists(this.__r, this.cookies, this.mirror);
    return await paginator.searchPublic(q, count, order);
  }

  async searchPrivateBooklists(q = "", count = 10, order = "") {
    if (order && !Object.values(OrderOptions).includes(order)) {
      throw new Error("Invalid order option");
    }

    const paginator = new Booklists(this.__r, this.cookies, this.mirror);
    return await paginator.searchPrivate(q, count, order);
  }
}

module.exports = ZlibProfile;
