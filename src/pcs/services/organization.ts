import {supabase} from "../lib/supabase";

export type OrganizationMembership={
  organization_id:string;
  unit_id:string|null;
  role:"admin"|"supervisor"|"operator";
  organization:{id:string;name:string;code:string;type:string};
  unit:{id:string;name:string;code:string;unit_type:"central"|"agency"}|null;
};

export async function getMyOrganizationMembership():Promise<OrganizationMembership|null>{
  if(!supabase) return null;
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return null;
  const {data,error}=await supabase.from("organization_users")
    .select("organization_id,unit_id,role,organizations(id,name,code,type),organization_units(id,name,code,unit_type)")
    .eq("user_id",user.id).eq("is_active",true).order("created_at",{ascending:true}).limit(1).maybeSingle();
  if(error) throw error;
  if(!data) return null;
  return {
    organization_id:data.organization_id,unit_id:data.unit_id,role:data.role as OrganizationMembership["role"],
    organization:(data as any).organizations,
    unit:(data as any).organization_units
  };
}

export async function listOrganizationTransfers(){
  if(!supabase) throw new Error("Supabase non configuré.");
  const {data,error}=await supabase.from("report_organization_transfers")
    .select("id,report_id,organization_id,from_mairie_id,status,transmitted_at,response_note")
    .order("transmitted_at",{ascending:false});
  if(error) throw error;
  const rows=data??[], ids=rows.map((x:any)=>x.report_id);
  if(!ids.length) return rows;
  const {data:reports,error:re}=await supabase.from("public_reports").select("id,reference_code,title,description,status,priority,latitude,longitude,location_label,created_at").in("id",ids);
  if(re) throw re;
  const byId=new Map((reports??[]).map((r:any)=>[r.id,r]));
  return rows.map((r:any)=>({...r,reports:byId.get(r.report_id)??null}));
}

export async function acceptOrganizationTransfer(id:string,note?:string){
  if(!supabase) throw new Error("Supabase non configuré.");
  const {data,error}=await supabase.rpc("organization_accept_transfer",{p_transfer_id:id,p_note:note?.trim()||undefined});
  if(error) throw error; return data;
}
export async function declineOrganizationTransfer(id:string,note:string){
  if(!supabase) throw new Error("Supabase non configuré.");
  const {data,error}=await supabase.rpc("organization_decline_transfer",{p_transfer_id:id,p_note:note});
  if(error) throw error; return data;
}
export async function listOrganizationUnits(organizationId:string){
  if(!supabase) throw new Error("Supabase non configuré.");
  const {data,error}=await supabase.from("organization_units").select("id,name,code,unit_type,region_id,is_active").eq("organization_id",organizationId).eq("is_active",true).order("unit_type").order("name");
  if(error) throw error; return data??[];
}
export async function assignOrganizationAgency(transferId:string,unitId:string,note?:string){
  if(!supabase) throw new Error("Supabase non configuré.");
  const {data,error}=await supabase.rpc("organization_assign_agency",{p_transfer_id:transferId,p_agency_unit_id:unitId,p_note:note?.trim()||undefined});
  if(error) throw error; return data;
}
export async function listAgencyMissions(unitId:string){
  if(!supabase) throw new Error("Supabase non configuré.");
  const {data,error}=await supabase.from("report_unit_assignments")
    .select("id,report_id,organization_id,unit_id,status,assigned_at,mission_note")
    .eq("unit_id",unitId).order("assigned_at",{ascending:false});
  if(error) throw error;
  const rows=data??[], ids=rows.map((x:any)=>x.report_id);
  if(!ids.length) return rows;
  const {data:reports,error:re}=await supabase.from("public_reports").select("id,reference_code,title,description,status,priority,latitude,longitude,location_label,created_at").in("id",ids);
  if(re) throw re;
  const byId=new Map((reports??[]).map((r:any)=>[r.id,r]));
  return rows.map((r:any)=>({...r,reports:byId.get(r.report_id)??null}));
}
export async function assignAgencyMissionToAgent(missionId:string,agentId:string,note?:string){
  if(!supabase) throw new Error("Supabase non configuré.");
  const {data,error}=await supabase.rpc("agency_assign_report_to_agent",{p_unit_assignment_id:missionId,p_agent_id:agentId,p_mission_note:note?.trim()||undefined});
  if(error) throw error; return data;
}
export async function listAgencyAgents(organizationId:string,unitId:string){
  if(!supabase) throw new Error("Supabase non configuré.");
  const {data,error}=await supabase.from("field_agents").select("id,first_name,last_name,matricule,qualification,phone,is_active,organization_id,organization_unit_id").eq("organization_id",organizationId).eq("organization_unit_id",unitId).eq("is_active",true).order("last_name");
  if(error) throw error; return data??[];
}

export async function createAgencyAgent(input:{first_name:string;last_name:string;matricule:string;qualification:string;phone?:string;password:string}){
 if(!supabase)throw new Error("Supabase non configuré.");
 const{data:{session},error:sessionError}=await supabase.auth.getSession();
 if(sessionError)throw new Error("Impossible de vérifier la session : "+sessionError.message);
 if(!session)throw new Error("Session requise. Reconnectez-vous puis réessayez.");
 const{data,error}=await supabase.functions.invoke("agency-create-agent",{body:input,headers:{Authorization:"Bearer "+session.access_token}});
 if(error){
  const context=(error as any).context;
  let message=error.message||"La création de l’agent a échoué.";
  if(context instanceof Response){
   try{
    const payload=await context.clone().json();
    if(typeof payload?.error==="string"&&payload.error.trim())message=payload.error.trim();
    else if(typeof payload?.message==="string"&&payload.message.trim())message=payload.message.trim();
   }catch{
    message="Le service de création d’agent a renvoyé une réponse inattendue. Vérifiez la configuration Supabase puis réessayez.";
   }
  }
  throw new Error(message);
 }
 if(!data?.agent)throw new Error(typeof data?.error==="string"?data.error:"Le service n’a pas confirmé la création de l’agent.");
 return data.agent;
}
