import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth";

// Extend Express's Request type so TypeScript knows req.userId can exist.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Any route that uses this middleware requires a valid "Authorization: Bearer <token>" header.
// It reads the token, verifies it, and attaches the userId to the request
// so later route handlers know who's making the call.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    next(); // token is valid, let the request continue to the actual route handler
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}