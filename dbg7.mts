import { getDb } from "./api/queries/connection";
import { siteContent } from "./db/schema";
import { eq } from "drizzle-orm";
import { settings } from "./db/schema";
async function main(){
const db=getDb();
await db.update(siteContent).set({value:"https://instagram.com/club10.test"}).where(eq(siteContent.key,"global.social.instagram"));
// revert the settings-table key I wrongly created/updated
await db.delete(settings).where(eq(settings.key,"global.social.instagram"));
console.log("done");
}
main();
