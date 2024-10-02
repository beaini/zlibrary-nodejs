// test/test.js

const AsyncZlib = require("../src/index").AsyncZlib;
const logger = require("../src/logger");
const config = require("../src/config"); // Import config if needed

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
    await lib.login(process.env.ZLOGIN, process.env.ZPASSW);

    // Count: 10 results per set
    const paginator = await lib.search(
      "biology",
      false,
      null,
      null,
      [],
      [],
      10
    );
    await paginator.next();

    if (paginator.result.length > 0) {
      console.log("First Set of Results:");
      console.log(paginator.result);
    }

    // Fetching next result set (10 ... 20)
    const nextSet = await paginator.next();

    if (nextSet.length > 0) {
      console.log("Second Set of Results:");
      console.log(nextSet);
    }

    // Get back to previous set (0 ... 10)
    const prevSet = await paginator.prev();

    if (prevSet.length > 0) {
      console.log("Previous Set of Results:");
      console.log(prevSet);
    }

    // Fetch download URLs for the first book in the current result set
    const firstBook = paginator.result[0];
    const bookDetails = await firstBook.fetch();
    if (bookDetails.name) {
      console.log("Book Details with Download URLs:");
      console.log(bookDetails);

      if (bookDetails.downloadUrls && bookDetails.downloadUrls.length > 0) {
        console.log("Available Download Formats:");
        bookDetails.downloadUrls.forEach((format) => {
          console.log(
            `- ${format.extension} (${format.filesize}): ${format.url}`
          );
        });
      } else {
        console.log("No download URLs available.");
      }
    }

    // Fetch a book by ID directly
    const bookId = "437612/42d522"; // Replace with a valid book ID
    const bookById = await lib.getById(bookId);
    if (bookById.name) {
      console.log("Book Fetched by ID with Download URLs:");
      console.log(bookById);

      if (bookById.downloadUrls && bookById.downloadUrls.length > 0) {
        console.log("Available Download Formats:");
        bookById.downloadUrls.forEach((format) => {
          console.log(
            `- ${format.extension} (${format.filesize}): ${format.url}`
          );
        });
      } else {
        console.log("No download URLs available.");
      }
    }
  } catch (error) {
    logger.error(error.message);
  }
})();
