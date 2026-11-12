import { getDb } from "./api/queries/connection";
import { lessons, blogPosts } from "./db/schema";
import { eq } from "drizzle-orm";
const db = getDb();
// first lesson of first module + latest published post get a YouTube link
const [l] = await db.select().from(lessons).limit(1);
await db.update(lessons).set({ videoUrl: "https://youtu.be/dQw4w9WgXcQ" }).where(eq(lessons.id, l.id));
console.log("lesson", l.id, l.code, "-> video set");
const [post] = await db.select().from(blogPosts).where(eq(blogPosts.status, "published")).limit(1);
if (post) {
  await db.update(blogPosts).set({ videoUrl: "https://youtu.be/dQw4w9WgXcQ" }).where(eq(blogPosts.id, post.id));
  console.log("post", post.slug, "-> video set");
}
process.exit(0);
