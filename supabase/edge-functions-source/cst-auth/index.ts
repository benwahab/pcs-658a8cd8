import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
async function hash(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Méthode non autorisée."},405);
 const url=Deno.env.get("SUPABASE_URL")!,serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
 const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
 const body=await req.json().catch(()=>({})); const action=body.action;
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