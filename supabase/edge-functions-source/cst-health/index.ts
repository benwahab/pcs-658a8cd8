import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method!=="GET")return json({error:"Méthode non autorisée."},405);
 const auth=req.headers.get("Authorization");if(!auth)return json({error:"Authentification requise."},401);
 const url=Deno.env.get("SUPABASE_URL")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,token=auth.replace(/^Bearer\s+/i,"");
 const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
 const {data:{user},error:userError}=await admin.auth.getUser(token);if(userError||!user)return json({error:"Session invalide."},401);
 const {data:account}=await admin.from("cst_accounts").select("id,email").eq("user_id",user.id).maybeSingle();if(!account)return json({error:"Accès CST refusé."},403);
 const started=performance.now();const {error}=await admin.from("regions").select("id").limit(1);const dbLatency=Math.round(performance.now()-started);
 return json({environment:"PRODUCTION",checked_at:new Date().toISOString(),database:{status:error?"degraded":"healthy",latency_ms:dbLatency},connected_sources:{database:true,authentication:true,frontend_errors:false,request_traces:false,backend_metrics:false,external_services:false}});
});