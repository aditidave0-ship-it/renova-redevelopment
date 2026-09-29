import express, { type ErrorRequestHandler, type Express, type RequestHandler } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.disable("x-powered-by");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : false,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: "256kb", strict: true }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

app.use("/api", router);

const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: "Not found", path: req.path });
};

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const status = typeof error?.status === "number" ? error.status : 500;
  const isValidationError = error?.name === "ZodError";
  const responseStatus = isValidationError ? 400 : status;

  if (responseStatus >= 500) {
    req.log?.error({ err: error }, "Unhandled API error");
  }

  res.status(responseStatus).json({
    error: isValidationError
      ? "Validation failed"
      : responseStatus === 413
        ? "Request body is too large"
        : responseStatus === 503 && error?.message === "DATABASE_URL is not configured"
          ? "Database is not configured"
        : responseStatus >= 500
          ? "Internal server error"
          : error?.message || "Invalid request",
    ...(isValidationError && Array.isArray(error?.issues)
      ? { issues: error.issues.map((issue: { path?: unknown[]; message?: string }) => ({ field: issue.path?.join("."), message: issue.message })) }
      : {}),
  });
};

app.use(notFound);
app.use(errorHandler);

export default app;
