import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { readFileSync } from "node:fs";
const schema = z.object({
  title: z.string(), blurb: z.string(),
  chapters: z.array(z.object({ heading: z.string(), paragraphs: z.array(z.string()) })),
});
const prompt = JSON.parse(readFileSync(process.argv[2], "utf8")).messages[0].content;
const client = createOpenAI({ apiKey: "ollama-local", baseURL: "http://localhost:11434/v1" });
const r = await generateObject({ model: client.chat("gemma4:12b"), schema, prompt });
console.log("finishReason:", r.finishReason, "usage:", JSON.stringify(r.usage));
console.log("chapters:", r.object.chapters.length);
console.log(JSON.stringify(r.object.chapters.map(c => [c.heading, c.paragraphs.map(p=>p.slice(0,40))]), null, 1));
