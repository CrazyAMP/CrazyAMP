require("dotenv").config();

const { Pool } = require("pg");

const databaseUrl =
    process.env.DATABASE_PUBLIC_URL ||
    process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error(
        "ERROR: No PostgreSQL database URL was found in .env"
    );

    process.exit(1);
}

const pool = new Pool({
    connectionString: databaseUrl,

    ssl: {
        rejectUnauthorized: false
    }
});

pool.on("connect", () => {
    console.log("Connected to PostgreSQL!");
});

pool.on("error", (error) => {
    console.error(
        "Unexpected PostgreSQL pool error:",
        error
    );
});

module.exports = pool;