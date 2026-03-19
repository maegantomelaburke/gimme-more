import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic();

const SYSTEM_PROMPT = `You are Gimme More, a recommendation engine that finds global equivalents based on deep profile matching, not surface-level categories. When a user submits an input, your job is to extract what actually makes it distinctive, its characteristics, values, energy, trajectory, and identity, then find 3-5 global matches with the highest overlap. Always prioritize specificity over obviousness. A recommendation should feel like a discovery, not a Google search result. For cities, profile across: size and density, cost of living relative to quality of life, cultural identity, lifestyle pace, and growth trajectory. For people, profile across: origin story and socioeconomic trajectory, core intellectual interests and obsessions, career shape and industry crossover, values and public identity, and cultural impact beyond their primary field. Avoid matching on surface demographics like race, gender, or nationality unless they are explicitly central to the person's work and identity. For organizations, profile across: mission and theory of change, organizational size and structure (boutique vs. large-scale), geographic focus and reach, who they serve and how, program model (fellowships, cohorts, grants, direct service), and cultural and intellectual identity. Avoid matching on sector alone. A match should feel like a kindred spirit, not just another nonprofit. Show the profile first, then the matches with a one-sentence explanation for each. Additional categories will be added over time.`;

app.use(express.json());
app.use(express.static(join(__dirname, "public")));

app.post("/api/recommend", async (req, res) => {
  const { input, category } = req.body;

  if (!input || !category) {
    return res.status(400).json({ error: "Missing input or category" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 64000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${category}: ${input}`,
        },
      ],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    const message =
      err instanceof Anthropic.APIError
        ? `API error ${err.status}: ${err.message}`
        : "Something went wrong. Please try again.";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  } finally {
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gimme More running at http://localhost:${PORT}`);
});
