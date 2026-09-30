import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
async function hash(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 const url=Deno.env.get("SUPABASE_URL")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
 const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
 if(req.method==="GET"){
  const {count,error}=await admin.from("cst_accounts").select("id",{count:"exact",head:true});
  if(error)return json({error:"État CST indisponible."},500);
  return json({configured:(count??0)>0});
 }
 if(req.method!=="POST")return json({error:"Méthode non autorisée."},405);
 const authHeader=req.headers.get("Authorization");
async function requireCst(){
 if(!authHeader) return null;
 const authClient=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false},global:{headers:{Authorization:authHeader}}});
 const {data:{user}}=await authClient.auth.getUser();
 if(!user)return null;
 const {data:account}=await admin.from("cst_accounts").select("id,user_id,email").eq("user_id",user.id).maybeSingle();
 return account?user:null;
}
const body=await req.json().catch(()=>({})); const action=body.action;
 
 if(action==="list_moderators"||action==="create_moderator"||action==="set_moderator_active"){
  const cstUser=await requireCst();
  if(!cstUser)return json({error:"Accès CST refusé."},403);
  if(action==="list_moderators"){
   const {data,error}=await admin.from("moderator_profiles").select("user_id,email,full_name,region_id,is_active,created_at,updated_at,regions(id,name,code)").order("created_at",{ascending:false});
   if(error)return json({error:"Impossible de charger les modérateurs."},500);
   return json({moderators:data??[]});
  }
  if(action==="create_moderator"){
   const email=String(body.email??"").trim().toLowerCase();
   const fullName=String(body.full_name??"").trim();
   const password=String(body.password??"");
   const regionId=String(body.region_id??"").trim();
   if(!/^\S+@\S+\.\S+$/.test(email)||fullName.length<2||password.length<12||!regionId)return json({error:"Nom, email, région et mot de passe d’au moins 12 caractères requis."},400);
   const {data:region,error:regionError}=await admin.from("regions").select("id,name,code").eq("id",regionId).maybeSingle();
   if(regionError||!region)return json({error:"Région invalide."},400);
   const {data:existing}=await admin.from("moderator_profiles").select("user_id").eq("email",email).maybeSingle();
   if(existing)return json({error:"Un modérateur utilise déjà cet email."},409);
   const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:fullName},app_metadata:{pcs_role:"moderator"}});
   if(createError||!created.user)return json({error:"Création du compte modérateur impossible."},400);
   const userId=created.user.id;
   const {data:role}=await admin.from("roles").select("id").eq("code","moderator").maybeSingle();
   if(!role){await admin.auth.admin.deleteUser(userId);return json({error:"Rôle modérateur introuvable."},500);}
   const {error:roleError}=await admin.from("user_roles").insert({user_id:userId,role_id:role.id});
   if(roleError){await admin.auth.admin.deleteUser(userId);return json({error:"Attribution du rôle modérateur impossible."},500);}
   const {error:profileError}=await admin.from("moderator_profiles").insert({user_id:userId,email,full_name:fullName,region_id:regionId,is_active:true});
   if(profileError){await admin.from("user_roles").delete().eq("user_id",userId).eq("role_id",role.id);await admin.auth.admin.deleteUser(userId);return json({error:"Création du profil modérateur impossible."},500);}
   return json({created:true,user_id:userId});
  }
  const userId=String(body.user_id??"").trim();
  const active=body.is_active===true;
  if(!userId)return json({error:"Modérateur requis."},400);
  const {data:profile,error:profileError}=await admin.from("moderator_profiles").select("user_id,is_active").eq("user_id",userId).maybeSingle();
  if(profileError||!profile)return json({error:"Modérateur introuvable."},404);
  const {error:updateError}=await admin.from("moderator_profiles").update({is_active:active}).eq("user_id",userId);
  if(updateError)return json({error:"Mise à jour du modérateur impossible."},500);
  const {error:authError}=await admin.auth.admin.updateUserById(userId,{ban_duration:active?"none":"876000h"});
  if(authError){await admin.from("moderator_profiles").update({is_active:profile.is_active}).eq("user_id",userId);return json({error:"Mise à jour de l’accès Auth impossible."},500);}
  return json({updated:true,is_active:active});
 }
 if(action==="status"){const {count,error}=await admin.from("cst_accounts").select("id",{count:"exact",head:true});if(error)return json({error:"État CST indisponible."},500);return json({configured:(count??0)>0});}
 if(action==="bootstrap"){
  const email=String(body.email??"").trim().toLowerCase(),password=String(body.password??"");
  if(!/^\S+@\S+\.\S+$/.test(email)||password.length<12)return json({error:"Email professionnel valide et mot de passe d’au moins 12 caractères requis."},400);
  const key=await hash("bootstrap:"+email);const {data:allowed,error:limitError}=await admin.rpc("consume_cst_auth_rate_limit",{p_key_hash:key,p_max_attempts:3,p_window_seconds:3600,p_block_seconds:3600});
  if(limitError||allowed!==true)return json({error:"Création CST temporairement bloquée. Réessayez plus tard."},429);
  const {count}=await admin.from("cst_registration_lock").select("id",{count:"exact",head:true});if((count??0)>0)return json({error:"Le compte CST a déjà été initialisé. L’inscription est définitivement fermée."},409);
  const {data:userData,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{cst_account:true}});
  if(createError||!userData.user)return json({error:"Création du compte CST impossible."},400);
  const {error:lockError}=await admin.from("cst_registration_lock").insert({id:1});
  if(lockError){await admin.auth.admin.deleteUser(userData.user.id);return json({error:"Le compte CST a déjà été initialisé. L’inscription est définitivement fermée."},409);}
  const {error:insertError}=await admin.from("cst_accounts").insert({id:1,user_id:userData.user.id,email});
  if(insertError){await admin.from("cst_registration_lock").delete().eq("id",1);await admin.auth.admin.deleteUser(userData.user.id);return json({error:"Création du compte CST impossible."},500);}
  return json({created:true});
 }
 if(action==="login"){
  const email=String(body.email??"").trim().toLowerCase(),password=String(body.password??"");if(!email||!password)return json({error:"Identifiants requis."},400);
  const key=await hash("login:"+email);const {data:allowed,error:limitError}=await admin.rpc("consume_cst_auth_rate_limit",{p_key_hash:key,p_max_attempts:5,p_window_seconds:600,p_block_seconds:900});
  if(limitError||allowed!==true)return json({error:"Trop de tentatives. Réessayez plus tard."},429);
  const {data:account}=await admin.from("cst_accounts").select("user_id").eq("email",email).maybeSingle();if(!account)return json({error:"Identifiants invalides."},401);
  const client=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});const {data,error}=await client.auth.signInWithPassword({email,password});
  if(error||!data.session||data.user.id!==account.user_id)return json({error:"Identifiants invalides."},401);
  return json({session:data.session,user:{id:data.user.id,email:data.user.email}});
 }
 return json({error:"Action CST inconnue."},400);
});