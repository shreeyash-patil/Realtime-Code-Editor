import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const { Pool } = pg;

export const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  host: "localhost",
  port: 5432,
});

pool.on("error", (err) => {
  console.error("[postgres] unexpected error on idle client", err);
});