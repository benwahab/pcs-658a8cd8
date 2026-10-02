import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Méthode non autorisée."},405);
  const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),anonKey=Deno.env.get("SUPABASE_ANON_KEY");
  if(!url||!serviceKey||!anonKey)return json({error:"Configuration serveur incomplète."},500);
  const authHeader=req.headers.get("Authorization");
  if(!authHeader)return json({error:"Authentification requise."},401);
  const auth=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false},global:{headers:{Authorization:authHeader}}});
  const {data:{user},error:authError}=await auth.auth.getUser();
  if(authError||!user)return json({error:"Session invalide."},401);
  const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:account}=await admin.from("cst_accounts").select("id").eq("user_id",user.id).maybeSingle();
  if(!account)return json({error:"Accès réservé au CST."},403);
  const body=await req.json().catch(()=>({}));
  if(body.action!=="hold"&&body.action!=="release")return json({error:"Action inconnue."},400);
  const archiveId=String(body.archive_id??"");
  if(!/^[0-9a-f-]{36}$/i.test(archiveId))return json({error:"Référence d'archive invalide."},400);
  const holdReason=String(body.reason??"").trim().slice(0,500);
  if(body.action==="hold"&&!holdReason)return json({error:"Une justification est obligatoire pour suspendre la suppression."},400);
  const {data,error}=await admin.from("cst_video_archives").update({hold_reason:body.action==="hold"?holdReason:null}).eq("id",archiveId).is("deleted_at",null).select("id,hold_reason,expires_at").maybeSingle();
  if(error)return json({error:"Impossible de mettre à jour la conservation."},500);
  if(!data)return json({error:"Archive introuvable ou déjà supprimée."},404);
  return json({archive:data});
});
