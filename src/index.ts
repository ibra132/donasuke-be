import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { userRoute } from "./routes/user.route";
import { authRoute } from "./routes/auth.route";
import { campaignRoute } from "./routes/campaign.route";
import { donationRoute } from "./routes/donation.route";
import { withdrawalRoute } from "./routes/withdrawal.route";

const app = new Hono();

app.route("/api/users", userRoute);
app.route("/api/auth", authRoute);
app.route("/api/campaign", campaignRoute);
app.route("/api/donation", donationRoute);
app.route("/api/withdrawal", withdrawalRoute);

app.get("/", (c) => {
  return c.json({ message: "Donasuke API is running" });
});

serve(
  {
    fetch: app.fetch,
    port: 3001,
  },
  () => {
    console.log("Donasuke API is running on http://localhost:3001");
  }
);
