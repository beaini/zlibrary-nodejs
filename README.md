# zlibrary-nodejs

A Node.js library for interacting with ZLibrary, enabling users to search for books, retrieve book details, manage download histories, and more. This library abstracts the complexities of web interactions, providing a clean and simple API for developers.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Setup](#setup)
  - [Logging In](#logging-in)
  - [Searching for Books](#searching-for-books)
  - [Fetching Book Details](#fetching-book-details)
  - [Managing Download History](#managing-download-history)
  - [Full-Text Search](#full-text-search)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Features

- **User Authentication**: Securely log in to ZLibrary accounts.
- **Search Functionality**: Search for books using various parameters like query, language, and file extensions.
- **Book Details**: Retrieve comprehensive details about books, including download URLs.
- **Download History**: Access and manage your download history.
- **Pagination**: Efficiently handle large sets of results with pagination support.
- **Configurable Logging**: Customize logging levels and integrate your own logger.
- **Proxy Support**: Use proxies, including SOCKS5 for Tor routing.

## Installation

Ensure you have [Node.js](https://nodejs.org/) installed. Then, install the library via npm:

```bash
npm install zlibrary-nodejs
```

Or using yarn:

```bash
yarn add zlibrary-nodejs
```

## Usage

### Setup

First, require the library in your project:

```javascript
const AsyncZlib = require("zlibrary-nodejs").AsyncZlib;
const logger = require("zlibrary-nodejs").logger;
```

### Logging In

Authenticate with your ZLibrary account credentials:

```javascript
require("dotenv").config(); // Ensure you have a .env file with ZLOGIN and ZPASSW

(async () => {
  try {
    const lib = new AsyncZlib({
      // Optional configurations
      // onion: true,
      // proxyList: ['socks5://127.0.0.1:9050'],
      // disableSemaphore: false,
      // customDomains: {
      //   ZLIB_DOMAIN: "https://custom-zlib-domain.com",
      //   LOGIN_DOMAIN: "https://custom-login-domain.com/rpc.php",
      // }
    });

    await lib.login(process.env.ZLOGIN, process.env.ZPASSW);
    console.log("Successfully logged in!");
  } catch (error) {
    logger.error(error.message);
  }
})();
```

### Searching for Books

Perform a search with various parameters:

```javascript
const paginator = await lib.search(
  "biology", // Query
  false, // Exact match
  null, // From year
  null, // To year
  ["english", "french"], // Languages
  ["PDF", "EPUB"], // File extensions
  10 // Results per page
);

// Fetch the first set of results
await paginator.next();
console.log("First Set of Results:", paginator.result);

// Fetch the next set of results
const nextSet = await paginator.next();
console.log("Second Set of Results:", nextSet);

// Navigate back to the previous set
const prevSet = await paginator.prev();
console.log("Previous Set of Results:", prevSet);
```

### Fetching Book Details

Retrieve detailed information and download URLs for a specific book:

```javascript
const firstBook = paginator.result[0];
const bookDetails = await firstBook.fetch();

console.log("Book Details:", bookDetails);

if (bookDetails.downloadUrls.length > 0) {
  console.log("Available Download Formats:");
  bookDetails.downloadUrls.forEach((format) => {
    console.log(`- ${format.extension} (${format.filesize}): ${format.url}`);
  });
} else {
  console.log("No download URLs available.");
}
```

### Managing Download History

Access your download history:

```javascript
const downloadHistory = await lib.profile.downloadHistory(1, null, null);
console.log("Download History:", downloadHistory.result);
```

### Full-Text Search

Perform a full-text search with advanced options:

```javascript
const fullTextPaginator = await lib.fullTextSearch(
  "quantum physics", // Query
  true, // Exact match
  true, // Phrase search
  false, // Words search
  2000, // From year
  2023, // To year
  ["english"], // Languages
  ["PDF"], // File extensions
  5 // Results per page
);

await fullTextPaginator.next();
console.log("Full-Text Search Results:", fullTextPaginator.result);
```

## Configuration

The library uses environment variables for sensitive information and configurable domains. Create a `.env` file in your project's root directory:

```env
ZLOGIN=your_email@example.com
ZPASSW=your_password
```

### Custom Domains

You can override default domains by passing a `customDomains` object when initializing `AsyncZlib`:

```javascript
const lib = new AsyncZlib({
  customDomains: {
    ZLIB_DOMAIN: "https://custom-zlib-domain.com",
    LOGIN_DOMAIN: "https://custom-login-domain.com/rpc.php",
    // Add other domains as needed
  },
});
```

## API Reference

### `AsyncZlib`

#### Constructor

```javascript
new AsyncZlib(options);
```

- `options` (Object):
  - `onion` (boolean, default: `false`): Use Tor (onion) domains.
  - `proxyList` (Array<string>, default: `[]`): List of proxy URLs.
  - `disableSemaphore` (boolean, default: `false`): Disable semaphore control.
  - `customDomains` (Object, default: `{}`): Override default domains.

#### Methods

- `login(email, password)`: Authenticates the user.
- `logout()`: Logs out the user.
- `search(q, exact, fromYear, toYear, lang, extensions, count)`: Searches for books.
- `getById(id)`: Retrieves a book by its ID.
- `fullTextSearch(q, exact, phrase, words, fromYear, toYear, lang, extensions, count)`: Performs a full-text search.

### `SearchPaginator`

Handles pagination for search results.

#### Methods

- `init()`: Initializes the paginator by fetching the first page.
- `next()`: Retrieves the next set of results.
- `prev()`: Retrieves the previous set of results.

### `BookItem`

Represents a single book.

#### Methods

- `fetch()`: Fetches detailed information and download URLs for the book.

### Exceptions

The library throws custom exceptions for various error scenarios:

- `EmptyQueryError`: When the search query is empty.
- `ProxyNotMatchError`: When the proxy list is not an array.
- `NoProfileError`: When attempting operations without logging in.
- `NoDomainError`: When no working domains are found.
- `NoIdError`: When no book ID is provided.
- `ParseError`: When parsing responses fails.

## License

This project is licensed under the [MIT License](LICENSE).

**Note**: Replace `yourusername`, `your.email@example.com`, and other placeholder texts with your actual GitHub username, email, and relevant information.
