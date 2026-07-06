import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { hashPassword, comparePassword, signToken } from "../lib/auth";

export const authRouter = Router();

// zod schemas validate the shape of incoming request bodies.
// If the body doesn't match, we reject the request before touching the DB.
const signupSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  agreedToTerms: z.boolean(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /auth/signup
authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
  }

  const { fullName, email, password, agreedToTerms } = parsed.data;

  if (!agreedToTerms) {
    return res.status(400).json({ message: "You must agree to the terms" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: "An account with this email already exists" });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { fullName, email, passwordHash },
  });

  const token = signToken(user.id);

  // Never send passwordHash back to the client
  const { passwordHash: _, ...safeUser } = user;

  res.status(201).json({ user: safeUser, token });
});

// POST /auth/login
authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input" });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = signToken(user.id);
  const { passwordHash: _, ...safeUser } = user;

  res.json({ user: safeUser, token });
});

// POST /auth/forgot-password
// For a portfolio project we just acknowledge the request.
// A production version would email a reset link with a short-lived token.
authRouter.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  // Always respond the same way whether or not the email exists,
  // so attackers can't use this endpoint to discover valid emails.
  res.json({ message: "If an account exists for this email, a reset link has been sent." });
});

// POST /auth/reset-password
authRouter.post("/reset-password", async (req, res) => {
  const { token, email, newPassword } = req.body;
  if (!token || !email || !newPassword) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // TODO: verify a real password-reset token here once email sending is wired up.
  res.json({ message: "Password has been reset." });
});

// POST /auth/logout
// JWTs are stateless, so "logout" is really just the frontend deleting its stored token.
// This endpoint exists for API completeness / future token-blacklisting.
authRouter.post("/logout", async (_req, res) => {
  res.json({ message: "Logged out" });
});