// src/index.js

const AsyncZlib = require("./libasync");
const { Extension, Language, OrderOptions } = require("./const");
const config = require("./config"); // Import centralized config

module.exports = {
  AsyncZlib,
  Extension,
  Language,
  OrderOptions,
  config, // Export config if needed externally
};
