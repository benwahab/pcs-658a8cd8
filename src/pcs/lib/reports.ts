import { supabase } from "./supabase";
import type { Category, PublicReport, Report, ReportPriority, ReportStatus } from "../types";

export async function listCategories():Promise<Category[]>{
 if(!supabase)return[];
 const {data,error}=await supabase.from("categories").select("id,name,slug").eq("is_active",true).order("name");
 if(error)throw error;
 return data??[];
}
export async function listPublicReports():Promise<PublicReport[]>{
 if(!supabase)return[];
 const {data,error}=await supabase.from("public_reports").select("*").order("created_at",{ascending:false});
 if(error)throw error;
 return (data??[]).map(r=>({...r,status:r.status as ReportStatus,priority:r.priority as ReportPriority}));
}
export async function listMyReports(userId:string):Promise<Report[]>{
 if(!supabase)return[];
 const {data,error}=await supabase.from("reports").select("*").eq("citizen_id",userId).order("created_at",{ascending:false});
 if(error)throw error;
 return (data??[]).map(r=>({...r,status:r.status as ReportStatus,priority:r.priority as ReportPriority}));
}
export async function createReport(input:{citizen_id:string;category_id:string;title:string;description:string;latitude?:number;longitude?:number;location_label?:string|null;priority?:Report["priority"];region_id?:string|null;commune_id:string}):Promise<Report>{
 if(!supabase)throw new Error("Supabase n'est pas configuré.");
 const reference_code="PCS-"+new Date().toISOString().slice(0,10).replace(/-/g,"")+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
 const {data,error}=await supabase.from("reports").insert({...input,reference_code,status:"submitted"}).select("*").single();
 if(error){
  if(error.code==="23505" && /déjà été signalé/i.test(error.message||"")) throw new Error("Ce problème a déjà été signalé. Un signalement existe déjà à moins de 20 mètres de cette position.");
  throw error;
 }
 return {...data,status:data.status as ReportStatus,priority:data.priority as ReportPriority};
}
export async function changeStatus(reportId:string,status:ReportStatus){
 if(!supabase)throw new Error("Supabase n'est pas configuré.");
 const {error}=await supabase.from("reports").update({status}).eq("id",reportId);
 if(error)throw error;
}
