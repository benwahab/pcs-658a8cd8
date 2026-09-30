import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Méthode non autorisée."},405);
  const url=Deno.env.get("SUPABASE_URL")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader=req.headers.get("Authorization"); if(!authHeader)return json({error:"Authentification requise."},401);
  const authClient=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false},global:{headers:{Authorization:authHeader}}});
  const {data:{user},error:userError}=await authClient.auth.getUser(); if(userError||!user)return json({error:"Session CST invalide."},401);
  const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:account}=await admin.from("cst_accounts").select("id,user_id,email").eq("user_id",user.id).maybeSingle(); if(!account)return json({error:"Accès CST refusé."},403);
  const body=await req.json().catch(()=>({})); const action=String(body.action??"list");
  if(action==="list"){
    const {data,error}=await admin.from("report_media").select("id,report_id,storage_path,media_type,file_size,created_at,captured_latitude,captured_longitude,uploaded_by,moderation_status").eq("media_role","citizen_evidence").like("media_type","video/%").eq("moderation_status","pending").order("created_at",{ascending:false}).limit(100);
    if(error)return json({error:"Impossible de charger la file de modération."},500);
    const items=[]; for(const media of data??[]){const {data:report}=await admin.from("reports").select("id,reference_code,title,description,status,priority,location_label,created_at,is_public").eq("id",media.report_id).maybeSingle();const {data:signed}=await admin.storage.from("report-media").createSignedUrl(media.storage_path,900);items.push({...media,report:report??null,preview_url:signed?.signedUrl??null});}
    return json({items});
  }
  const mediaId=String(body.media_id??"").trim(); if(!mediaId)return json({error:"Média requis."},400);
  const {data:media,error:mediaError}=await admin.from("report_media").select("id,report_id,storage_path,media_role,media_type,moderation_status").eq("id",mediaId).maybeSingle();
  if(mediaError||!media||media.media_role!=="citizen_evidence" || !String(media.media_type??"").startsWith("video/"))return json({error:"Vidéo de signalement introuvable."},404);
  if(media.moderation_status!=="pending")return json({error:"Cette vidéo a déjà été traitée."},409);
  if(action==="approve"){
    const now=new Date().toISOString();
    const {error}=await admin.from("report_media").update({moderation_status:"approved",moderated_at:now,moderated_by:user.id,moderation_reason:null}).eq("id",mediaId).eq("moderation_status","pending");
    if(error)return json({error:"Approbation impossible."},500);
    const {error:historyError}=await admin.from("cst_media_moderation_history").insert({media_id:mediaId,moderator_id:user.id,action:"approved",reason:null});
    if(historyError)return json({success:true,status:"approved",audit_logged:false,warning:"Vidéo approuvée, mais l’écriture de l’historique doit être vérifiée."});
    return json({success:true,status:"approved",audit_logged:true});
  }
  if(action==="reject"){
    const reason=String(body.reason??"").trim(); if(reason.length<5)return json({error:"Un motif de rejet d’au moins 5 caractères est requis."},400);
    const {error:updateError}=await admin.from("report_media").update({moderation_status:"rejected",moderated_at:new Date().toISOString(),moderated_by:user.id,moderation_reason:reason}).eq("id",mediaId).eq("moderation_status","pending");
    if(updateError)return json({error:"Rejet impossible."},500);
    const {error:historyError}=await admin.from("cst_media_moderation_history").insert({media_id:mediaId,moderator_id:user.id,action:"rejected",reason});
    const {error:storageError}=await admin.storage.from("report-media").remove([media.storage_path]);
    if(historyError)return json({success:true,status:"rejected",storage_deleted:!storageError,audit_logged:false,warning:"Vidéo bloquée de la publication, mais l’écriture de l’historique doit être vérifiée."});
    if(storageError)return json({success:true,status:"rejected",storage_deleted:false,audit_logged:true,warning:"Vidéo bloquée de la publication, mais la suppression du fichier de stockage doit être vérifiée."});
    return json({success:true,status:"rejected",storage_deleted:true,audit_logged:true});
  }
  return json({error:"Action de modération inconnue."},400);
});