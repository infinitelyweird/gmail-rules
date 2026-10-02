import fs from "node:fs/promises";
import path from "node:path";
import {authenticate} from "@google-cloud/local-auth";
import {google} from "googleapis";
export const SCOPES=[
 "https://www.googleapis.com/auth/gmail.settings.basic",
 "https://www.googleapis.com/auth/gmail.labels",
 "https://www.googleapis.com/auth/gmail.readonly"
];
export async function getAuth(){
 const creds=path.join(process.cwd(),"credentials.json"), token=path.join(process.cwd(),"token.json");
 try{
   const raw=JSON.parse(await fs.readFile(token,"utf8"));
   if(!raw.scopes?.includes("https://www.googleapis.com/auth/gmail.readonly")) throw new Error("scope upgrade");
   return google.auth.fromJSON(raw);
 }catch{}
 const c=await authenticate({scopes:SCOPES,keyfilePath:creds});
 const src=JSON.parse(await fs.readFile(creds,"utf8")), k=src.installed||src.web;
 await fs.writeFile(token,JSON.stringify({
   type:"authorized_user",client_id:k.client_id,client_secret:k.client_secret,
   refresh_token:c.credentials.refresh_token,scopes:SCOPES
 },null,2));
 return c;
}