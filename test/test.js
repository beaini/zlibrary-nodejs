// test/test.js

const { AsyncZlib } = require("../src/index");
const logger = require("../src/logger");

require("dotenv").config();

(async () => {
  try {
    const lib = new AsyncZlib();
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
      console.log(paginator.result);
    }

    // Fetching next result set (10 ... 20)
    const nextSet = await paginator.next();

    if (nextSet.length > 0) {
      console.log(nextSet);
    }

    // Get back to previous set (0 ... 10)
    const prevSet = await paginator.prev();

    if (prevSet.length > 0) {
      console.log(prevSet);
    }

    const book = await paginator.result[0].fetch();
    if (book.name) {
      console.log(book);
    }

    const bookById = await lib.getById("437612/42d522");
    if (bookById.name) {
      console.log(bookById);
    }
  } catch (error) {
    logger.error(error.message);
  }
})();
