import { getDb } from "/mnt/agents/output/app/api/queries/connection";
import { blogPosts } from "/mnt/agents/output/app/db/schema";
import { eq } from "drizzle-orm";
async function main(){ const db=getDb(); await db.update(blogPosts).set({coverImage:"/uploads/cms/mwd8b5d9-fae67954853f.png"}).where(eq(blogPosts.slug,"welcome-to-club-10")); console.log("cover set"); }
main();
