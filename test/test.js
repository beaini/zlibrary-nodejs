// test/test.js

const AsyncZlib = require("../src/index").AsyncZlib;
const logger = require("../src/logger");
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

    // Iterate through the search results to verify that each book has an ID, title, and author
    paginator.result.forEach((book, index) => {
      // Check for valid ID
      assert(
        typeof book.id === "string" && book.id.trim() !== "",
        `Book at index ${index} does not have a valid ID.`
      );
      logger.info(`Book ID at index ${index}: ${book.id}`);

      // Check for valid Title (name)
      assert(
        typeof book.name === "string" && book.name.trim() !== "",
        `Book at index ${index} does not have a valid title.`
      );
      logger.info(`Book Title at index ${index}: ${book.name}`);

      // Check for valid Author(s)
      assert(
        Array.isArray(book.authors),
        `Book at index ${index} does not have a valid authors array.`
      );
      // Optionally, check that the authors array is not empty
      // assert(
      //   book.authors.length > 0,
      //   `Book at index ${index} has an empty authors array.`
      // );
      logger.info(
        `Book Authors at index ${index}: ${book.authors
          .map((a) => a.author)
          .join(", ")}`
      );
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

    // Check for valid Title (name) in bookDetails
    assert(
      typeof bookDetails.name === "string" && bookDetails.name.trim() !== "",
      "Book details do not contain a valid title."
    );
    logger.info(`Book Details Title: ${bookDetails.name}`);

    // Check for valid Author(s) in bookDetails
    assert(
      Array.isArray(bookDetails.authors),
      "Book details do not contain a valid authors array."
    );
    // Optionally, check that the authors array is not empty
    // assert(
    //   bookDetails.authors.length > 0,
    //   "Book details have an empty authors array."
    // );
    logger.info(
      `Book Details Authors: ${bookDetails.authors
        .map((a) => a.author)
        .join(", ")}`
    );

    // Check that download URLs are present if available
    assert(
      Array.isArray(bookDetails.downloadUrls),
      "Book details do not contain a valid downloadUrls array."
    );
    logger.info(`Number of Download URLs: ${bookDetails.downloadUrls.length}`);

    if (bookDetails.downloadUrls.length > 0) {
      bookDetails.downloadUrls.forEach((format, idx) => {
        // Check for valid format ID
        assert(
          typeof format.id === "number" && format.id > 0,
          `Download format at index ${idx} does not have a valid ID.`
        );

        // Check for valid extension
        assert(
          typeof format.extension === "string" &&
            format.extension.trim() !== "",
          `Download format at index ${idx} does not have a valid extension.`
        );

        // Check for valid URL
        assert(
          typeof format.url === "string" && format.url.startsWith("http"),
          `Download format at index ${idx} does not have a valid URL.`
        );

        logger.info(
          `- Download URL ${idx + 1}: ID=${format.id}, Extension=${
            format.extension
          }, URL=${format.url}`
        );
      });
    } else {
      logger.warn("No download URLs available for the first book.");
    }

    // Fetch a book by ID directly
    const bookId = firstBook.id; // Using the ID from the first search result
    logger.info(`Fetching book by ID: ${bookId}`);
  } catch (error) {
    logger.error(`Test failed: ${error.message}`);
    process.exit(1); // Exit with a failure code
  }
})();
