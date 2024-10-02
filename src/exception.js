// src/exception.js

class LoopError extends Error {
  constructor(message) {
    super(message);
    this.name = "LoopError";
  }
}

class ParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "ParseError";
  }
}

class NoDomainError extends Error {
  constructor() {
    super("No working domains have been found. Try again later.");
    this.name = "NoDomainError";
  }
}

class EmptyQueryError extends Error {
  constructor() {
    super("Search query is empty.");
    this.name = "EmptyQueryError";
  }
}

class ProxyNotMatchError extends Error {
  constructor() {
    super("proxy_list must be an array.");
    this.name = "ProxyNotMatchError";
  }
}

class NoProfileError extends Error {
  constructor() {
    super(
      "You have to log in into your singlelogin.me account to access zlibrary. Use login() before performing the search."
    );
    this.name = "NoProfileError";
  }
}

class NoIdError extends Error {
  constructor() {
    super("No ID provided for the book lookup.");
    this.name = "NoIdError";
  }
}

module.exports = {
  LoopError,
  ParseError,
  NoDomainError,
  EmptyQueryError,
  ProxyNotMatchError,
  NoProfileError,
  NoIdError,
};
