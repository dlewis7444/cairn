import { Hono } from "hono";
import { sendDigest } from "../email.ts";

const route = new Hono();

route.post("/send", async (c) => {
  try {
    const result = await sendDigest();
    return c.json(result);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

export default route;
