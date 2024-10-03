// src/axiosInstance.js

const axios = require("axios");
const HttpsProxyAgent = require("https-proxy-agent");
const SocksProxyAgent = require("socks-proxy-agent");

let axiosInstance = null;
let currentCookies = {};
let currentProxyList = [];

function createAxiosInstance(proxyList = [], cookies = {}) {
  currentCookies = cookies;
  currentProxyList = proxyList;

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
  };

  if (Object.keys(cookies).length > 0) {
    headers.Cookie = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  const options = {
    headers,
    timeout: 180000, // 180 seconds
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

  axiosInstance = axios.create(options);
  return axiosInstance;
}

function getAxiosInstance() {
  if (!axiosInstance) {
    // Create a default instance if none exists
    axiosInstance = createAxiosInstance();
  }
  return axiosInstance;
}

function updateCookies(cookies = {}) {
  currentCookies = { ...currentCookies, ...cookies };
  // Recreate axios instance with updated cookies
  createAxiosInstance(currentProxyList, currentCookies);
}

function getCurrentCookies() {
  return currentCookies;
}

module.exports = {
  createAxiosInstance,
  getAxiosInstance,
  updateCookies,
  getCurrentCookies,
};
