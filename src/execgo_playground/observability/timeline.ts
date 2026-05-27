import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { TimelineEvent } from "../models.js";
import { ensureDir } from "../utils.js";

export class TimelineRecorder {
  outputPath: string;
  private eventRows: TimelineEvent[] = [];

  constructor(outputPath: string) {
    this.outputPath = outputPath;
  }

  record(event: Omit<TimelineEvent, "timestamp" | "metadata"> & { metadata?: Record<string, unknown> }): void {
    this.eventRows.push({
      ...event,
      timestamp: new Date().toISOString(),
      metadata: event.metadata ?? {},
    });
  }

  async flush(): Promise<string> {
    await ensureDir(path.dirname(this.outputPath));
    await writeFile(this.outputPath, this.eventRows.map((event) => JSON.stringify(event)).join("\n") + "\n", "utf8");
    return this.outputPath;
  }

  get events(): TimelineEvent[] {
    return [...this.eventRows];
  }
}
