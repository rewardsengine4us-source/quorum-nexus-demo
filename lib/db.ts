const B=(process.env.NEXT_PUBLIC_SUPABASE_URL||"")+"/rest/v1/";const K=process.env.SUPABASE_SERVICE_ROLE_KEY||"";export const DEMO="demo-user-001";export const KEY_OK=!!K;
function H(x?:any){const h:any={apikey:K,Authorization:"Bearer "+K,"Content-Type":"application/json"};if(x)for(const k in x)h[k]=x[k];return h;}
async function R(m:string,p:string,b?:any,x?:any){const r=await fetch(B+p,{method:m,headers:H(x),body:b===undefined?undefined:JSON.stringify(b),cache:"no-store"});const t=await r.text();let j:any=null;if(t){try{j=JSON.parse(t);}catch(e){j=t;}}if(!r.ok)throw new Error("postgrest "+r.status+": "+((j&&j.message)||String(t).slice(0,180)));return j;}
export async function sel(t:string,q:string):Promise<any[]>{const r=await R("GET",t+"?"+q);return Array.isArray(r)?r:[];}
export async function one(t:string,q:string){const r=await sel(t,q+"&limit=1");return r.length?r[0]:null;}
export async function ins(t:string,rows:any){return R("POST",t,rows,{Prefer:"return=representation"});}
export async function up(t:string,rows:any,oc:string,ig?:boolean){return R("POST",t+"?on_conflict="+encodeURIComponent(oc),rows,{Prefer:(ig?"resolution=ignore-duplicates":"resolution=merge-duplicates")+",return=minimal"});}
export async function patch(t:string,q:string,b:any){return R("PATCH",t+"?"+q,b,{Prefer:"return=minimal"});}
export async function del(t:string,q:string){return R("DELETE",t+"?"+q,undefined,{Prefer:"return=minimal"});}
