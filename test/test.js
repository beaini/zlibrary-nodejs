// test/test.js

const AsyncZlib = require("../src/index").AsyncZlib;
const logger = require("../src/logger");
const assert = require("assert"); // Import the assert module
const fs = require("fs");
const path = require("path");

// Load environment variables from .env file
require("dotenv").config();

/**
 * Utility function to save binary data to disk for verification (optional).
 * @param {Buffer} data - The binary data to save.
 * @param {string} filename - The name of the file.
 * @param {string} folder - The destination folder.
 */
function saveBinaryData(data, filename, folder) {
  const destinationFolder = path.resolve(__dirname, folder);
  if (!fs.existsSync(destinationFolder)) {
    fs.mkdirSync(destinationFolder, { recursive: true });
  }
  const filePath = path.join(destinationFolder, filename);
  fs.writeFileSync(filePath, data);
  logger.info(`Binary data saved to: ${filePath}`);
}

(async () => {
  try {
    // Initialize the AsyncZlib library
    const lib = new AsyncZlib({
      // Optionally override domains here
      // customDomains: {
      //   ZLIB_DOMAIN: "https://custom-zlib-domain.com",
      //   LOGIN_DOMAIN: "https://custom-login-domain.com/rpc.php",
      //   // Add other domains as needed
      // }
    });

    // Retrieve login credentials from environment variables
    const email = process.env.ZLOGIN;
    const password = process.env.ZPASSW;

    if (!email || !password) {
      throw new Error(
        "Please set ZLOGIN and ZPASSW in your environment variables."
      );
    }

    // Attempt to log in
    await lib.login(email, password);
    logger.info("Logged in successfully.");

    // Perform a search with the query "biology"
    const searchQuery = "biology";
    const paginator = await lib.search(
      searchQuery,
      false, // public search
      null, // dateFrom
      null, // dateTo
      [], // languages
      [], // extensions
      10 // results per page
    );

    // Fetch the first page of results
    await paginator.next();

    // Validate that search results are present
    assert(paginator.result.length > 0, "Search returned no results.");
    logger.info(
      `Search for "${searchQuery}" returned ${paginator.result.length} results.`
    );

    // Iterate through the search results to verify each book's integrity
    paginator.result.forEach((book, index) => {
      // Check for a valid ID
      assert(
        typeof book.id === "string" && book.id.trim() !== "",
        `Book at index ${index} does not have a valid ID.`
      );
      logger.info(`Book ID at index ${index}: ${book.id}`);

      // Check for a valid Title (name)
      assert(
        typeof book.name === "string" && book.name.trim() !== "",
        `Book at index ${index} does not have a valid title.`
      );
      logger.info(`Book Title at index ${index}: ${book.name}`);

      // Check for a valid Author(s) array
      assert(
        Array.isArray(book.authors),
        `Book at index ${index} does not have a valid authors array.`
      );

      // Optionally, ensure that the authors array is not empty
      assert(
        book.authors.length > 0,
        `Book at index ${index} has an empty authors array.`
      );

      logger.info(
        `Book Authors at index ${index}: ${book.authors
          .map((a) => a.author)
          .join(", ")}`
      );
    });

    // Select the first book from the search results
    const firstBook = paginator.result[0];

    // Fetch detailed information about the first book
    const bookItemInstance = await firstBook.fetch();

    // Verify that the fetched book details contain the correct ID
    assert.strictEqual(
      bookItemInstance.id,
      firstBook.id,
      "Fetched book ID does not match the search result ID."
    );
    logger.info(
      `Fetched book ID matches the search result ID: ${bookItemInstance.id}`
    );

    // Check for a valid Title (name) in bookDetails
    assert(
      typeof bookItemInstance.name === "string" &&
        bookItemInstance.name.trim() !== "",
      "Book details do not contain a valid title."
    );
    logger.info(`Book Details Title: ${bookItemInstance.name}`);

    // Validate that download URLs are present and correctly structured
    assert(
      Array.isArray(bookItemInstance.downloadUrls),
      "Book details do not contain a valid downloadUrls array."
    );
    logger.info(
      `Number of Download URLs: ${bookItemInstance.downloadUrls.length}`
    );

    if (bookItemInstance.downloadUrls.length > 0) {
      bookItemInstance.downloadUrls.forEach((format, idx) => {
        // Check for a valid format ID
        assert(
          typeof format.id === "number" && format.id > 0,
          `Download format at index ${idx} does not have a valid ID.`
        );

        // Check for a valid extension
        assert(
          typeof format.extension === "string" &&
            format.extension.trim() !== "",
          `Download format at index ${idx} does not have a valid extension.`
        );

        // Check for a valid URL
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

    // Attempt to download the first available format for the first book
    if (bookItemInstance.downloadUrls.length > 0) {
      const downloadFormat = bookItemInstance.downloadUrls[0]; // Select the first format
      const desiredExtension = downloadFormat.extension;

      logger.info(
        `Attempting to download "${bookItemInstance.name}" as ${desiredExtension}...`
      );

      // Define an optional progress callback
      const onProgress = (percent) => {
        process.stdout.write(`Download Progress: ${percent}%\r`);
      };

      // Perform the download and retrieve binary data
      const binaryData = await bookItemInstance.download(desiredExtension);

      // Validate that binaryData is a Buffer and contains data
      assert(Buffer.isBuffer(binaryData), "Downloaded data is not a Buffer.");
      assert(binaryData.length > 0, "Downloaded Buffer is empty.");

      logger.info(
        `Download successful. Received ${binaryData.length} bytes of data.`
      );

      // Optionally, save the binary data to disk for verification
      // Uncomment the following lines if you wish to save the file
      /*
      const sanitizedFileName = `${bookItemInstance.name.replace(/[/\\?%*:|"<>]/g, '-')}.${desiredExtension.toLowerCase()}`;
      saveBinaryData(binaryData, sanitizedFileName, 'downloads');
      */
    } else {
      logger.warn("No download URLs available to perform download.");
    }

    // Additional Test: Fetch a book by ID directly (if such functionality exists)
    // This part assumes that your library supports fetching a book by its ID
    try {
      const fetchedBook = await lib.getById(firstBook.id);
      assert(
        fetchedBook.id === firstBook.id,
        "Fetched book by ID does not match the expected book."
      );
      logger.info(`Successfully fetched book by ID: ${fetchedBook.id}`);
    } catch (fetchError) {
      logger.warn(
        `Unable to fetch book by ID: ${firstBook.id}. Error: ${fetchError.message}`
      );
      // Depending on your library's functionality, decide whether to throw the error or continue
      // throw fetchError;
    }

    logger.info("All tests passed successfully.");
  } catch (error) {
    logger.error(`Test failed: ${error.message}`);
    process.exit(1); // Exit with a failure code
  }
})();
