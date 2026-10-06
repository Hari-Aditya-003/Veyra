import { env } from "cloudflare:workers";

type Metric = "gallery_views" | "downloads" | "guest_uploads";

const timestamps: Record<Metric, string> = {
  gallery_views: "last_view_at",
  downloads: "last_download_at",
  guest_uploads: "last_guest_upload_at",
};

export async function recordEventMetric(eventId: string, metric: Metric, amount = 1) {
  const safeAmount = Math.max(1, Math.min(100, Math.floor(amount)));
  const timestamp = timestamps[metric];
  const now = Date.now();

  try {
    await env.DB.prepare(
      `INSERT INTO event_metrics (event_id, ${metric}, ${timestamp}) VALUES (?, ?, ?)
       ON CONFLICT(event_id) DO UPDATE SET
         ${metric} = ${metric} + excluded.${metric},
         ${timestamp} = excluded.${timestamp}`,
    ).bind(eventId, safeAmount, now).run();
  } catch (error) {
    console.warn(JSON.stringify({
      level: "warn",
      event: "event_metric_write_failed",
      metric,
      eventId,
      message: error instanceof Error ? error.message : "Unknown analytics error",
    }));
  }
}
