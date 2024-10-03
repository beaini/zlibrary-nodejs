// src/util.js

const axios = require("axios");
const { getAxiosInstance } = require("./axiosInstance");
const { LoopError } = require("./exception");
const logger = require("./logger");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
};

const TIMEOUT = 180000; // 180 seconds
const HEAD_TIMEOUT = 4000; // 4 seconds

async function GET_request(url, expectJson = false) {
  try {
    const instance = getAxiosInstance();
    logger.info(`GET ${url}`);

    const response = await instance.get(url);

    if (expectJson && typeof response.data === "string") {
      try {
        return JSON.parse(response.data);
      } catch (error) {
        throw new ParseError("Failed to parse JSON response.");
      }
    }

    return response.data;
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

async function POST_request(url, data) {
  try {
    const instance = getAxiosInstance();
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

async function HEAD_request(url) {
  try {
    const instance = getAxiosInstance();
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
