import fs from "node:fs/promises";
import {google} from "googleapis";
import {getAuth} from "./auth.js";

const argv=process.argv.slice(2);
const val=(name,dflt)=>Number((argv.find(x=>x.startsWith(`--${name}=`))||`--${name}=${dflt}`).split("=")[1]);
const months=val("months",12), max=val("max",5000), concurrency=val("concurrency",3), delayMs=val("delay",250);
const CHECKPOINT="inventory-checkpoint.json", JSON_OUT="sender-inventory.json", CSV_OUT="sender-inventory.csv";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const gmail=google.gmail({version:"v1",auth:await getAuth()});
const query=`newer_than:${months}m -in:trash -in:spam`;

async function retry(fn,label){
 let wait=2000;
 for(let attempt=1;attempt<=8;attempt++){
  try{return await fn()}
  catch(e){
   const msg=e?.response?.data?.error?.message||e?.message||"";
   const reason=e?.response?.data?.error?.errors?.[0]?.reason||"";
   const rate=e?.response?.status===429 || e?.response?.status===403 &&
     (reason==="rateLimitExceeded"||/quota|rate limit/i.test(msg));
   if(!rate||attempt===8)throw e;
   console.log(`  quota pause (${label}) — ${Math.round(wait/1000)}s, retry ${attempt}/8`);
   await sleep(wait);
   wait=Math.min(wait*2,60000);
  }
 }
}

async function getIds(){
 let ids=[],pageToken;
 while(ids.length<max){
  const r=await retry(()=>gmail.users.messages.list({userId:"me",q:query,maxResults:500,pageToken}),"message list");
  ids.push(...(r.data.messages||[])); pageToken=r.data.nextPageToken;
  if(!pageToken)break;
  await sleep(300);
 }
 return ids.slice(0,max).map(x=>x.id);
}

let cp={query,months,max,done:{},startedAt:new Date().toISOString()};
try{
 const old=JSON.parse(await fs.readFile(CHECKPOINT,"utf8"));
 if(old.query===query && old.max===max){cp=old;console.log(`Resuming checkpoint with ${Object.keys(cp.done).length} completed messages.`)}
}catch{}

const ids=await getIds();
console.log(`Inventory target: ${ids.length} messages`);
console.log(`Concurrency: ${concurrency}; inter-batch delay: ${delayMs}ms`);

async function fetchOne(id){
 return retry(async()=>{
  const r=await gmail.users.messages.get({userId:"me",id,format:"metadata",metadataHeaders:["From","Subject"]});
  const h=Object.fromEntries((r.data.payload?.headers||[]).map(x=>[x.name.toLowerCase(),x.value]));
  return {from:h.from||"(unknown)",subject:h.subject||""};
 },id.slice(-8));
}

let completed=Object.keys(cp.done).length;
for(let i=0;i<ids.length;i+=concurrency){
 const batch=ids.slice(i,i+concurrency).filter(id=>!cp.done[id]);
 if(batch.length){
  const results=await Promise.all(batch.map(async id=>[id,await fetchOne(id)]));
  for(const [id,data] of results){cp.done[id]=data;completed++}
 }
 if(completed%50<concurrency || i+concurrency>=ids.length){
  cp.updatedAt=new Date().toISOString();
  await fs.writeFile(CHECKPOINT,JSON.stringify(cp));
  console.log(`  ${completed}/${ids.length} complete (checkpoint saved)`);
 }
 await sleep(delayMs);
}

const counts=new Map(),samples=new Map();
for(const {from,subject} of Object.values(cp.done)){
 const email=(from.match(/<([^>]+)>/)?.[1]||from).trim().toLowerCase();
 counts.set(email,(counts.get(email)||0)+1);
 if(!samples.has(email))samples.set(email,[]);
 if(samples.get(email).length<8 && !samples.get(email).includes(subject))samples.get(email).push(subject);
}
const report=[...counts].sort((a,b)=>b[1]-a[1]).map(([sender,count])=>({sender,count,sampleSubjects:samples.get(sender)}));
const out={query,messageCount:ids.length,processedCount:Object.keys(cp.done).length,generatedAt:new Date().toISOString(),senders:report};
await fs.writeFile(JSON_OUT,JSON.stringify(out,null,2));
const esc=s=>String(s).replaceAll('"','""');
await fs.writeFile(CSV_OUT,"count,sender,sample subjects\n"+report.map(x=>`${x.count},"${esc(x.sender)}","${esc(x.sampleSubjects.join(" | "))}"`).join("\n"));
console.log(`\nDONE — ${out.processedCount} messages, ${report.length} unique senders.`);
console.log("Top 30:");
report.slice(0,30).forEach(x=>console.log(String(x.count).padStart(5),x.sender,"—",x.sampleSubjects[0]||""));
console.log(`\nWrote ${JSON_OUT}, ${CSV_OUT}, and resumable ${CHECKPOINT}.`);