import { supabase } from "../lib/supabase";
import type { ReportPriority, ReportStatus } from "../types";

export type ReportFilter={status?:ReportStatus;priority?:ReportPriority;categoryId?:string;departmentId?:string;search?:string};

export async function listAllReports(filters:ReportFilter={}){
 if(!supabase)throw new Error("Supabase n’est pas configuré.");
 let q=supabase.from("reports").select("*,categories(name),departments(name)").order("created_at",{ascending:false});
 if(filters.status)q=q.eq("status",filters.status);
 if(filters.priority)q=q.eq("priority",filters.priority);
 if(filters.categoryId)q=q.eq("category_id",filters.categoryId);
 if(filters.departmentId)q=q.eq("department_id",filters.departmentId);
 const search=filters.search?.trim().slice(0,80);
 if(search){const safe=search.replace(/[%_,]/g," ").replace(/\s+/g," ").trim();if(safe)q=q.or("title.ilike.%"+safe+"%,reference_code.ilike.%"+safe+"%");}
 const {data,error}=await q;
 if(error)throw error;
 return data??[];
}
export async function updateReportStatus(id:string,status:ReportStatus,resolutionNote?:string){if(!supabase)throw new Error("Supabase n’est pas configuré.");const note=status==="resolved"?(resolutionNote??"").trim():null;if(status==="resolved"&&(note??"").length<5)throw new Error("Une note de résolution d’au moins 5 caractères est obligatoire.");const {error}=await supabase.from("reports").update({status,resolution_note:note}).eq("id",id);if(error)throw error;}
export async function updateReportPriority(id:string,priority:ReportPriority){if(!supabase)throw new Error("Supabase n’est pas configuré.");const {error}=await supabase.from("reports").update({priority}).eq("id",id);if(error)throw error;}
export async function listDepartments(){if(!supabase)throw new Error("Supabase n’est pas configuré.");const {data,error}=await supabase.from("departments").select("id,name,code").eq("is_active",true).order("name");if(error)throw error;return data??[];}
export async function listCategoriesForAdmin(){if(!supabase)throw new Error("Supabase n’est pas configuré.");const {data,error}=await supabase.from("categories").select("id,name").eq("is_active",true).order("name");if(error)throw error;return data??[];}
export async function listAssignableAgents(){if(!supabase)throw new Error("Supabase n’est pas configuré.");const {data,error}=await supabase.from("user_roles").select("user_id,roles(code)").eq("roles.code","agent");if(error)throw error;return data??[];}
export async function assignReport(reportId:string,departmentId:string,agentId?:string|null){if(!supabase)throw new Error("Supabase n’est pas configuré.");const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Session requise.");const {data:existing}=await supabase.from("report_assignments").select("id").eq("report_id",reportId).is("unassigned_at",null).limit(1);if(existing?.[0]){const {error}=await supabase.from("report_assignments").update({unassigned_at:new Date().toISOString()}).eq("id",existing[0].id);if(error)throw error;}const {error}=await supabase.from("report_assignments").insert({report_id:reportId,department_id:departmentId,agent_id:agentId??null,assigned_by:user.id});if(error)throw error;const {error:updateError}=await supabase.from("reports").update({department_id:departmentId}).eq("id",reportId);if(updateError)throw updateError;}
export async function addInternalComment(reportId:string,body:string){if(!supabase)throw new Error("Supabase n’est pas configuré.");const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Session requise.");const clean=body.trim();if(!clean||clean.length>5000)throw new Error("La note doit contenir entre 1 et 5000 caractères.");const {error}=await supabase.from("report_comments").insert({report_id:reportId,author_id:user.id,body:clean,visibility:"internal"});if(error)throw error;}
export async function listReportComments(reportId:string){if(!supabase)throw new Error("Supabase n’est pas configuré.");const {data,error}=await supabase.from("report_comments").select("id,author_id,body,visibility,created_at").eq("report_id",reportId).eq("visibility","internal").order("created_at",{ascending:true});if(error)throw error;return data??[];}

export type OrganizationSignupRequest={
 id:string;user_id:string;organization_id:string;organization_name:string;organization_code:string;
 email:string;full_name:string;status:"pending"|"approved"|"rejected";review_note:string|null;reviewed_by:string|null;reviewed_at:string|null;created_at:string;
};
export async function listOrganizationSignupRequests(){
 if(!supabase)throw new Error("Supabase n’est pas configuré.");
 const {data,error}=await supabase.rpc("list_organization_signup_requests");
 if(error)throw error; return (data??[]) as OrganizationSignupRequest[];
}
export async function approveOrganizationSignupRequest(id:string,note?:string){
 if(!supabase)throw new Error("Supabase n’est pas configuré.");
 const {data,error}=await supabase.rpc("approve_organization_signup_request",{p_request_id:id,p_note:note?.trim()||null});
 if(error)throw error; return data;
}
export async function rejectOrganizationSignupRequest(id:string,note:string){
 if(!supabase)throw new Error("Supabase n’est pas configuré.");
 const {data,error}=await supabase.rpc("reject_organization_signup_request",{p_request_id:id,p_note:note.trim()});
 if(error)throw error; return data;
}

export type MairieSignupRequest={
 id:string;name:string;region_id:string;region_name:string;commune_id:string;commune_name:string;
 account_user_id:string;phone:string|null;mayor_name:string|null;latitude:number|null;longitude:number|null;
 location_label:string|null;is_active:boolean;approval_status:"pending"|"approved"|"rejected";created_at:string;
};
export async function listPendingMairieRequests(){
 if(!supabase)throw new Error("Supabase n’est pas configuré.");
 const {data,error}=await supabase.rpc("list_pending_mairie_requests");
 if(error)throw error; return (data??[]) as MairieSignupRequest[];
}
export async function approveMairieRequest(id:string){
 if(!supabase)throw new Error("Supabase n’est pas configuré.");
 const {data,error}=await supabase.rpc("approve_mairie_request",{p_mairie_id:id});
 if(error)throw error; return data;
}
export async function rejectMairieRequest(id:string){
 if(!supabase)throw new Error("Supabase n’est pas configuré.");
 const {data,error}=await supabase.rpc("reject_mairie_request",{p_mairie_id:id});
 if(error)throw error; return data;
}
