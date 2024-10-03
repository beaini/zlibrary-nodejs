// test/test.js

const AsyncZlib = require("../src/index").AsyncZlib;
const logger = require("../src/logger");
const config = require("../src/config"); // Import config if needed
const assert = require("assert"); // Import the assert module

require("dotenv").config();

(async () => {
  try {
    const lib = new AsyncZlib({
      // Optionally override domains here
      // customDomains: {
      //   ZLIB_DOMAIN: "https://custom-zlib-domain.com",
      //   LOGIN_DOMAIN: "https://custom-login-domain.com/rpc.php",
      //   // Add other domains as needed
      // }
    });

    // Ensure that login credentials are provided
    const email = process.env.ZLOGIN;
    const password = process.env.ZPASSW;

    if (!email || !password) {
      throw new Error(
        "Please set ZLOGIN and ZPASSW in your environment variables."
      );
    }

    await lib.login(email, password);
    logger.info("Logged in successfully.");

    // Perform a search with the query "biology"
    const searchQuery = "biology";
    const paginator = await lib.search(
      searchQuery,
      false,
      null,
      null,
      [],
      [],
      10
    );

    await paginator.next();

    // Check that the paginator has results
    assert(paginator.result.length > 0, "Search returned no results.");
    logger.info(
      `Search for "${searchQuery}" returned ${paginator.result.length} results.`
    );

    // Iterate through the search results to verify that each book has an ID
    paginator.result.forEach((book, index) => {
      assert(
        typeof book.id === "string" && book.id.trim() !== "",
        `Book at index ${index} does not have a valid ID.`
      );
      logger.info(`Book ID at index ${index}: ${book.id}`);
    });

    // Fetch download URLs for the first book in the current result set
    const firstBook = paginator.result[0];
    const bookDetails = await firstBook.fetch();

    // Verify that the fetched book details contain the correct ID
    assert.strictEqual(
      bookDetails.id,
      firstBook.id,
      "Fetched book ID does not match the search result ID."
    );
    logger.info(
      `Fetched book ID matches the search result ID: ${bookDetails.id}`
    );

    // Check that download URLs are present if available
    if (bookDetails.downloadUrls && bookDetails.downloadUrls.length > 0) {
      logger.info("Available Download Formats:");
      bookDetails.downloadUrls.forEach((format, idx) => {
        assert(
          typeof format.extension === "string" &&
            format.extension.trim() !== "",
          `Download format at index ${idx} does not have a valid extension.`
        );
        assert(
          typeof format.url === "string" && format.url.startsWith("http"),
          `Download format at index ${idx} does not have a valid URL.`
        );
        logger.info(
          `- Format ID: ${format.id}, Extension: ${format.extension}, URL: ${format.url}`
        );
      });
    } else {
      logger.warn("No download URLs available for the first book.");
    }

    // Fetch a book by ID directly
    const bookId = firstBook.id; // Using the ID from the first search result
    logger.info(`Fetching book by ID: ${bookId}`);
    const bookById = await lib.getById(bookId);

    // Verify that the fetched book by ID has the correct ID
    assert.strictEqual(
      bookById.id,
      bookId,
      "Fetched book by ID does not match the requested ID."
    );
    logger.info(`Fetched book by ID matches the requested ID: ${bookById.id}`);

    // Check that download URLs are present if available
    if (bookById.downloadUrls && bookById.downloadUrls.length > 0) {
      logger.info("Available Download Formats for Book by ID:");
      bookById.downloadUrls.forEach((format, idx) => {
        assert(
          typeof format.extension === "string" &&
            format.extension.trim() !== "",
          `Download format at index ${idx} does not have a valid extension.`
        );
        assert(
          typeof format.url === "string" && format.url.startsWith("http"),
          `Download format at index ${idx} does not have a valid URL.`
        );
        logger.info(
          `- Format ID: ${format.id}, Extension: ${format.extension}, URL: ${format.url}`
        );
      });
    } else {
      logger.warn("No download URLs available for the book fetched by ID.");
    }

    logger.info("All tests passed successfully.");
  } catch (error) {
    logger.error(`Test failed: ${error.message}`);
    process.exit(1); // Exit with a failure code
  }
})();
