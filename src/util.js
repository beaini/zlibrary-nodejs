// src/util.js

const axios = require("axios");
const HttpsProxyAgent = require("https-proxy-agent");
const SocksProxyAgent = require("socks-proxy-agent");
const { LoopError } = require("./exception");
const logger = require("./logger");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
};

const TIMEOUT = 180000; // 180 seconds
const HEAD_TIMEOUT = 4000; // 4 seconds

function createAxiosInstance(proxyList, timeout) {
  const options = {
    headers: HEADERS,
    timeout,
  };

  if (proxyList && proxyList.length > 0) {
    const proxyUrl = proxyList[0];
    if (proxyUrl.startsWith("socks")) {
      options.httpAgent = new SocksProxyAgent(proxyUrl);
      options.httpsAgent = new SocksProxyAgent(proxyUrl);
      options.proxy = false;
    } else {
      options.httpAgent = new HttpsProxyAgent(proxyUrl);
      options.httpsAgent = new HttpsProxyAgent(proxyUrl);
      options.proxy = false;
    }
  }

  return axios.create(options);
}

async function GET_request(
  url,
  cookies = {},
  proxyList = [],
  saveCookies = false
) {
  try {
    const instance = createAxiosInstance(proxyList, TIMEOUT);

    if (cookies && Object.keys(cookies).length > 0) {
      instance.defaults.headers.Cookie = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join("; ");
    }

    logger.info(`GET ${url}`);

    const response = await instance.get(url);

    if (saveCookies) {
      return [response.data, response.headers["set-cookie"] || []];
    } else {
      return response.data;
    }
  } catch (error) {
    if (axios.isCancel(error)) {
      throw new LoopError(
        "Async operation was cancelled before request could finish."
      );
    } else {
      throw error;
    }
  }
}

async function POST_request(url, data, proxyList = []) {
  try {
    const instance = createAxiosInstance(proxyList, TIMEOUT);
    logger.info(`POST ${url}`);
    const response = await instance.post(url, data);
    return [response.data, response.headers["set-cookie"] || []];
  } catch (error) {
    if (axios.isCancel(error)) {
      throw new LoopError(
        "Async operation was cancelled before request could finish."
      );
    } else {
      throw error;
    }
  }
}

async function HEAD_request(url, proxyList = []) {
  try {
    const instance = createAxiosInstance(proxyList, HEAD_TIMEOUT);
    logger.info(`Checking connectivity of ${url}...`);
    const response = await instance.head(url);
    return response.status;
  } catch (error) {
    if (axios.isCancel(error)) {
      throw new LoopError(
        "Async operation was cancelled before request could finish."
      );
    } else if (error.code === "ECONNABORTED") {
      return 0;
    } else {
      throw error;
    }
  }
}

module.exports = {
  GET_request,
  POST_request,
  HEAD_request,
  HEADERS,
};
