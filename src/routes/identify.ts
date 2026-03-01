import { Router, Request, Response } from "express";
import { identify } from "../services/identityService";
import { IdentifyRequest } from "../types";

const router = Router();

/**
 * POST /identify
 * Body: { email?: string, phoneNumber?: string | number }
 */
router.post("/identify", async (req: Request, res: Response): Promise<void> => {
  const body = req.body as IdentifyRequest;

  const email = body.email ?? null;
  const phoneNumber = body.phoneNumber ? String(body.phoneNumber) : null;

  if (!email && !phoneNumber) {
    res.status(400).json({
      error: "At least one of email or phoneNumber must be provided",
    });
    return;
  }

  try {
    const result = await identify({ email, phoneNumber });
    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error in /identify:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
