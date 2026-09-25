import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
const normalizePhone=(v:string)=>v.replace(/[^0-9+]/g,"");
async function sha256(value:string){
 const bytes=new TextEncoder().encode(value);
 const digest=await crypto.subtle.digest("SHA-256",bytes);
 return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

Deno.serve(async(req)=>{
 try{
  if(req.method!=="POST") return json({error:"Méthode non autorisée"},405);
  const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin=createClient(url,service),auth=createClient(url,anon);
  const body=await req.json();
  const phone=normalizePhone(String(body.phone??"").trim());
  if(!phone)return json({error:"Numéro de téléphone obligatoire."},400);

  if(body.step==="identify"||body.lookup===true){
   const {data:agent,error}=await admin.from("field_agents").select("user_id,first_name,last_name,matricule,qualification").eq("phone_normalized",phone).eq("is_active",true).maybeSingle();
   if(error)return json({error:"Service indisponible."},500);
   if(!agent)return json({error:"Ce numéro n'est pas enregistré comme agent terrain.",identified:false},404);
   const raw=crypto.randomUUID()+"."+crypto.randomUUID();
   const hash=await sha256(raw);
   await admin.from("agent_login_challenges").delete().eq("agent_user_id",agent.user_id);
   const {error:ce}=await admin.from("agent_login_challenges").insert({agent_user_id:agent.user_id,challenge_hash:hash,expires_at:new Date(Date.now()+5*60*1000).toISOString()});
   if(ce)return json({error:"Impossible de préparer la connexion."},500);
   return json({identified:true,challenge:raw,agent:{first_name:agent.first_name,last_name:agent.last_name,matricule:agent.matricule,qualification:agent.qualification}});
  }

  const challenge=String(body.challenge??"");
  const password=String(body.password??"");
  if(!challenge||!password)return json({error:"Connexion invalide."},400);
  const hash=await sha256(challenge);
  const {data:row,error:qe}=await admin.from("agent_login_challenges").select("id,agent_user_id,expires_at,consumed_at").eq("challenge_hash",hash).maybeSingle();
  if(qe||!row||row.consumed_at||new Date(row.expires_at).getTime()<=Date.now())return json({error:"Session de connexion expirée. Recommencez avec votre numéro."},401);
  const {data:agent,error:ae}=await admin.from("field_agents").select("user_id,is_active").eq("user_id",row.agent_user_id).maybeSingle();
  if(ae||!agent?.is_active)return json({error:"Compte agent inactif."},403);
  const {error:consumeError}=await admin.from("agent_login_challenges").update({consumed_at:new Date().toISOString()}).eq("id",row.id).is("consumed_at",null);
  if(consumeError)return json({error:"Connexion invalide."},401);
  const internalEmail="agent-"+row.agent_user_id.replace(/-/g,"")+"@agent.pcs.local";
  const {data,error:loginError}=await auth.auth.signInWithPassword({email:internalEmail,password});
  if(loginError||!data.session)return json({error:"Mot de passe incorrect."},401);
  return json({session:data.session,user:data.user});
 }catch(e){return json({error:e instanceof Error?e.message:"Erreur interne"},500)}
});