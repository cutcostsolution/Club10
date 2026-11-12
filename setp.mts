import { getDb } from "/mnt/agents/output/app/api/queries/connection";
import { products } from "/mnt/agents/output/app/db/schema";
import { eq } from "drizzle-orm";
async function main(){ const db=getDb(); await db.update(products).set({imageUrl:"/uploads/cms/mwd8f4ne-b824e2d2474d.png"}).where(eq(products.id,1)); console.log("set"); }
main();
