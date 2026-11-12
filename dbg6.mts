import { getDb } from "./api/queries/connection";
import { settings } from "./db/schema";
import { eq } from "drizzle-orm";
async function main(){
const db=getDb();
const [row]=await db.select().from(settings).where(eq(settings.key,"global.social.instagram"));
if(row) await db.update(settings).set({value:"https://instagram.com/club10.test"}).where(eq(settings.key,row.key));
else await db.insert(settings).values({key:"global.social.instagram",value:"https://instagram.com/club10.test"});
console.log("set");
}
main();
