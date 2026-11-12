import { getDb } from "./api/queries/connection";
import { siteContent } from "./db/schema";
import { eq } from "drizzle-orm";
async function main(){
const db=getDb();
await db.update(siteContent).set({value:""}).where(eq(siteContent.key,"global.social.instagram"));
console.log("reverted");
}
main();
