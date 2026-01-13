import { env } from "@Contest-Platform/env/server";
import cors from "cors";
import express from "express";
import router from "./routes";

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
  }),
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

app.use("/api", router);

const PORT = env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
