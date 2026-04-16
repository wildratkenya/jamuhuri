import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { podcastsTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { insertPodcastSchema } from "@workspace/db";
import { PatchPodcastParams, PatchPodcastBody } from "@workspace/api-zod";
import { fetchBuzzsproutLatestEpisodes } from "../lib/buzzsprout-feed";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/podcasts", async (req, res) => {
  const parsed = insertPodcastSchema.safeParse({
    title: req.body.title,
    description: req.body.description,
    audioUrl: req.body.audioUrl || undefined,
    buzzsproutUrl: req.body.buzzsproutUrl || undefined,
    duration: req.body.duration || undefined,
    episodeNumber: req.body.episodeNumber ? Number(req.body.episodeNumber) : null,
    season: req.body.season ? Number(req.body.season) : null,
    publishedAt: req.body.publishedAt ? new Date(req.body.publishedAt) : new Date(),
    thumbnailUrl: req.body.thumbnailUrl || undefined,
    tags: typeof req.body.tags === "string"
      ? req.body.tags.split(",").map((tag: string) => tag.trim()).filter(Boolean)
      : req.body.tags || [],
  });

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }

  const [podcast] = await db.insert(podcastsTable).values(parsed.data).returning();
  res.status(201).json({
    ...podcast,
    publishedAt: podcast.publishedAt.toISOString(),
    created_at: podcast.created_at.toISOString(),
  });
});

router.get("/podcasts", async (_req, res) => {
  const podcasts = await db
    .select()
    .from(podcastsTable)
    .orderBy(desc(podcastsTable.publishedAt));
  res.json(
    podcasts.map((p) => ({
      ...p,
      publishedAt: p.publishedAt.toISOString(),
      created_at: p.created_at.toISOString(),
    }))
  );
});

router.get("/podcasts/latest", async (_req, res) => {
  const podcasts = await db
    .select()
    .from(podcastsTable)
    .orderBy(desc(podcastsTable.publishedAt))
    .limit(3);
  res.json(
    podcasts.map((p) => ({
      ...p,
      publishedAt: p.publishedAt.toISOString(),
      created_at: p.created_at.toISOString(),
    }))
  );
});

/** Latest episodes from Buzzsprout RSS (for homepage). */
router.get("/podcasts/feed-latest", async (_req, res) => {
  try {
    const episodes = await fetchBuzzsproutLatestEpisodes(3);
    res.set("Cache-Control", "public, max-age=600, s-maxage=600, stale-while-revalidate=3600");
    res.json(episodes);
  } catch (err) {
    logger.error({ err }, "Buzzsprout RSS fetch failed");
    res.status(502).json({ error: "Could not load podcast feed" });
  }
});

router.patch("/podcasts/:id", async (req, res) => {
  const params = PatchPodcastParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = PatchPodcastBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.format() });
    return;
  }
  const patch = parsed.data;
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (entries.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [existing] = await db.select().from(podcastsTable).where(eq(podcastsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Podcast not found" });
    return;
  }

  const updatePayload = Object.fromEntries(entries);

  const [podcast] = await db
    .update(podcastsTable)
    .set(updatePayload)
    .where(eq(podcastsTable.id, params.data.id))
    .returning();

  if (!podcast) {
    res.status(404).json({ error: "Podcast not found" });
    return;
  }

  res.json({
    ...podcast,
    publishedAt: podcast.publishedAt.toISOString(),
    created_at: podcast.created_at.toISOString(),
  });
});

export default router;
