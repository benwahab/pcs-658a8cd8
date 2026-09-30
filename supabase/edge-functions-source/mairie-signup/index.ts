import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  try{
    if(req.method!=="POST") return json({error:"Méthode non autorisée"},405);
    const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,db=createClient(url,key);
    const forwarded=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const realIp=req.headers.get("cf-connecting-ip")?.trim()||forwarded||"unknown";
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(realIp+"|pcs-mairie-signup"));
    const keyHash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
    const {data:allowed,error:rateError}=await db.rpc("consume_mairie_signup_rate_limit",{p_key_hash:keyHash,p_max_attempts:5,p_window_seconds:900,p_block_seconds:1800});
    if(rateError)return json({error:"Service temporairement indisponible. Réessayez plus tard."},503);
    if(allowed===false)return json({error:"Trop de tentatives. Réessayez plus tard."},429);
    const b=await req.json();
    for(const k of ["name","region_id","commune_id","email","password"]) if(!b[k]||String(b[k]).trim()==="") return json({error:"Champs obligatoires manquants"},400);
    if(String(b.password).length<8) return json({error:"Le mot de passe doit contenir au moins 8 caractères"},400);
    const name=String(b.name).trim();
    const email=String(b.email).trim().toLowerCase();
    const mayorName=String(b.mayor_name??"").trim();
    const phone=String(b.phone??"").trim();
    const locationLabel=String(b.location_label??"").trim();
    if(name.length<2||name.length>150)return json({error:"Le nom de la mairie doit contenir entre 2 et 150 caractères."},400);
    if(mayorName.length<2||mayorName.length>120)return json({error:"Le nom du maire doit contenir entre 2 et 120 caractères."},400);
    if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254)return json({error:"Adresse email invalide."},400);
    if(phone.length>30)return json({error:"Numéro de téléphone invalide."},400);
    if(locationLabel.length>250)return json({error:"Libellé de localisation trop long."},400);
    if((b.latitude!=null&&(!Number.isFinite(Number(b.latitude))||Number(b.latitude)<-90||Number(b.latitude)>90))||(b.longitude!=null&&(!Number.isFinite(Number(b.longitude))||Number(b.longitude)<-180||Number(b.longitude)>180)))return json({error:"Coordonnées GPS invalides."},400);
    const {data:commune,error:ce}=await db.from("communes").select("id,name,region_id,regions(id,name)").eq("id",b.commune_id).eq("region_id",b.region_id).eq("is_active",true).single();
    if(ce||!commune) return json({error:"Commune/localité invalide pour cette région"},400);
    if(commune.regions?.name==="Niamey"&&commune.name!=="VILLE DE NIAMEY") return json({error:"Pour Niamey, la localité unique est Ville de Niamey."},400);
    const {data:existing}=await db.from("mairies").select("id").eq("commune_id",b.commune_id).maybeSingle();
    if(existing) return json({error:"Cette mairie/localité est déjà enregistrée ou fait déjà l’objet d’une demande."},409);
    const {data:u,error:ue}=await db.auth.admin.createUser({email,password:String(b.password),email_confirm:true,user_metadata:{full_name:name,role:"mairie",mairie_pending:true}});
    if(ue||!u.user) return json({error:ue?.message||"Création impossible"},400);
    const uid=u.user.id;
    const {data:role,error:roleErr}=await db.from("roles").select("id").eq("code","mairie").single();
    if(roleErr){await db.auth.admin.deleteUser(uid);return json({error:"Configuration du rôle mairie indisponible."},500)}
    const {error:profileErr}=await db.from("profiles").upsert({id:uid,full_name:name,phone:phone||null});
    if(profileErr){await db.auth.admin.deleteUser(uid);return json({error:"Création du profil mairie impossible."},500)}
    const {error:urErr}=await db.from("user_roles").insert({user_id:uid,role_id:role.id});
    if(urErr){await db.auth.admin.deleteUser(uid);return json({error:"Attribution du rôle mairie impossible."},500)}
    const {data:mairie,error:me}=await db.from("mairies").insert({name,region_id:b.region_id,commune_id:b.commune_id,account_user_id:uid,phone:phone||null,mayor_name:mayorName||null,latitude:b.latitude??null,longitude:b.longitude??null,location_label:locationLabel||null,is_active:false}).select("id,name,region_id,commune_id,is_active").single();
    if(me){await db.auth.admin.deleteUser(uid);return json({error:me.message.includes("mairies_name_key")||me.message.includes("mairies_commune_id_unique")?"Cette mairie/localité est déjà enregistrée.":"Création de la mairie impossible."},400)}
    return new Response(JSON.stringify({mairie,status:"pending",message:"Demande reçue. Le compte sera activé après validation de l'habilitation de la mairie."}),{headers:{"content-type":"application/json"}});
  }catch(e){return json({error:e instanceof Error?e.message:"Erreur interne"},500)}
});