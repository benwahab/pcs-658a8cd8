import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";

Deno.serve(async(req)=>{
  try{
    if(req.method!=="POST") return new Response(JSON.stringify({error:"Méthode non autorisée"}),{status:405});
    const url=Deno.env.get("SUPABASE_URL")!,key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,db=createClient(url,key);
    const b=await req.json();
    for(const k of ["name","region_id","commune_id","email","password"]) if(!b[k]||String(b[k]).trim()==="") return new Response(JSON.stringify({error:"Champs obligatoires manquants"}),{status:400});
    if(String(b.password).length<8) return new Response(JSON.stringify({error:"Le mot de passe doit contenir au moins 8 caractères"}),{status:400});
    const {data:commune,error:ce}=await db.from("communes").select("id,name,region_id,regions(id,name)").eq("id",b.commune_id).eq("region_id",b.region_id).eq("is_active",true).single();
    if(ce||!commune) return new Response(JSON.stringify({error:"Commune/localité invalide pour cette région"}),{status:400});
    if(commune.regions?.name==="Niamey"&&commune.name!=="VILLE DE NIAMEY") return new Response(JSON.stringify({error:"Pour Niamey, la localité unique est Ville de Niamey."}),{status:400});
    const {data:existing}=await db.from("mairies").select("id").eq("commune_id",b.commune_id).maybeSingle();
    if(existing) return new Response(JSON.stringify({error:"Cette mairie/localité est déjà enregistrée ou fait déjà l'objet d'une demande."}),{status:409});
    const email=String(b.email).trim().toLowerCase();
    const {data:u,error:ue}=await db.auth.admin.createUser({email,password:String(b.password),email_confirm:true,user_metadata:{full_name:String(b.name).trim(),role:"mairie",mairie_pending:true}});
    if(ue||!u.user) return new Response(JSON.stringify({error:ue?.message||"Création impossible"}),{status:400});
    const uid=u.user.id;
    const {data:role,error:roleErr}=await db.from("roles").select("id").eq("code","mairie").single();
    if(roleErr){await db.auth.admin.deleteUser(uid);return new Response(JSON.stringify({error:roleErr.message}),{status:400})}
    await db.from("profiles").upsert({id:uid,full_name:String(b.name).trim(),phone:b.phone||null});
    const {error:urErr}=await db.from("user_roles").insert({user_id:uid,role_id:role.id});
    if(urErr){await db.auth.admin.deleteUser(uid);return new Response(JSON.stringify({error:urErr.message}),{status:400})}
    const {data:mairie,error:me}=await db.from("mairies").insert({name:String(b.name).trim(),region_id:b.region_id,commune_id:b.commune_id,account_user_id:uid,phone:b.phone||null,mayor_name:b.mayor_name||null,latitude:b.latitude??null,longitude:b.longitude??null,location_label:b.location_label||null,is_active:false}).select("id,name,region_id,commune_id,is_active").single();
    if(me){await db.auth.admin.deleteUser(uid);return new Response(JSON.stringify({error:me.message}),{status:400})}
    return new Response(JSON.stringify({mairie,status:"pending",message:"Demande reçue. Le compte sera activé après validation de l'habilitation de la mairie."}),{headers:{"content-type":"application/json"}});
  }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"Erreur interne"}),{status:500})}
});