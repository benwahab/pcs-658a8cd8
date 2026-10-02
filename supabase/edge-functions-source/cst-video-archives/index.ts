import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Méthode non autorisée."},405);
 const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),anonKey=Deno.env.get("SUPABASE_ANON_KEY");
 if(!url||!serviceKey||!anonKey)return json({error:"Configuration serveur incomplète."},500);
 const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
 const authHeader=req.headers.get("Authorization");
 const cronSecret=Deno.env.get("PCS_ARCHIVE_CLEANUP_SECRET");
 const suppliedSecret=req.headers.get("x-archive-cleanup-secret");
 let authorized=false;
 if(cronSecret&&suppliedSecret&&suppliedSecret===cronSecret)authorized=true;
 if(!authorized&&authHeader){
   const auth=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false},global:{headers:{Authorization:authHeader}}});
   const {data:{user}}=await auth.auth.getUser();
   if(user){const {data:account}=await admin.from("cst_accounts").select("id").eq("user_id",user.id).maybeSingle();authorized=!!account;}
 }
 if(!authorized)return json({error:"Accès réservé au CST ou au service de maintenance autorisé."},403);
 const body=await req.json().catch(()=>({}));
 const dryRun=body.dry_run===true;
 const limit=Math.max(1,Math.min(Number(body.limit)||50,100));
 const {data:expired,error}=await admin.from("cst_video_archives")
   .select("id,media_id,report_id,expires_at,hold_reason,report_media!inner(storage_path)")
   .is("deleted_at",null).lt("expires_at",new Date().toISOString()).is("hold_reason",null)
   .order("expires_at",{ascending:true}).limit(limit);
 if(error)return json({error:"Impossible de sélectionner les archives arrivées à échéance."},500);
 if(dryRun)return json({dry_run:true,candidates:(expired??[]).map((x:any)=>({id:x.id,expires_at:x.expires_at})),count:expired?.length??0});
 const results=[];
 for(const row of expired??[]){
   const media=(row as any).report_media;
   const path=media?.storage_path;
   if(!path){results.push({id:row.id,outcome:"failed"});continue;}
   const {error:removeError}=await admin.storage.from("report-media").remove([path]);
   if(removeError){
     await admin.from("cst_archive_cleanup_log").insert({archive_id:row.id,media_id:row.media_id,report_id:row.report_id,storage_path:path,outcome:"failed",details:String(removeError.message??removeError).slice(0,1000)});
     results.push({id:row.id,outcome:"failed"});continue;
   }
   const {error:markError}=await admin.from("cst_video_archives").update({deleted_at:new Date().toISOString()}).eq("id",row.id).is("deleted_at",null);
   if(markError){
     await admin.from("cst_archive_cleanup_log").insert({archive_id:row.id,media_id:row.media_id,report_id:row.report_id,storage_path:path,outcome:"deleted",details:"Objet supprimé du stockage; marquage de l'archive à réconcilier: "+String(markError.message).slice(0,900)});
     results.push({id:row.id,outcome:"deleted_needs_reconciliation"});continue;
   }
   await admin.from("cst_archive_cleanup_log").insert({archive_id:row.id,media_id:row.media_id,report_id:row.report_id,storage_path:path,outcome:"deleted"});
   results.push({id:row.id,outcome:"deleted"});
 }
 return json({dry_run:false,processed:results.length,results});
});
