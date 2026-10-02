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
  if(!authHeader)return json({error:"Authentification CST requise."},401);
  const auth=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false},global:{headers:{Authorization:authHeader}}});
  const {data:{user},error:authError}=await auth.auth.getUser();
  if(authError||!user)return json({error:"Session invalide."},401);
  const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:account}=await admin.from("cst_accounts").select("id").eq("user_id",user.id).maybeSingle();
  if(!account)return json({error:"Accès aux archives réservé au CST."},403);
  const body=await req.json().catch(()=>({}));
  const action=String(body.action??"list");
  if(action==="list"){
    const {data,error}=await admin.from("cst_video_archives")
      .select("id,media_id,report_id,archived_at,expires_at,hold_reason,deleted_at,report_media!inner(id,storage_path,media_type,file_size,created_at),reports!inner(id,reference_code,title,location_label,status,created_at,region_id)")
      .is("deleted_at",null)
      .order("archived_at",{ascending:false})
      .limit(200);
    if(error)return json({error:"Impossible de charger les archives vidéo."},500);
    const items=[];
    for(const row of data??[]){
      const media=(row as any).report_media;
      if(!media?.storage_path)continue;
      const {data:signed,error:signedError}=await admin.storage.from("report-media").createSignedUrl(media.storage_path,900);
      items.push({...row,preview_url:signedError?null:signed?.signedUrl??null,report:(row as any).reports,report_media:undefined,reports:undefined});
    }
    return json({items,scope:"cst-only",signed_url_ttl_seconds:900});
  }
  return json({error:"Action inconnue."},400);
});
