import { supabase } from "../lib/supabase";

const MAX_IMAGE_SIZE=8*1024*1024;
const ALLOWED_IMAGES=["image/jpeg","image/png","image/webp"];
const ALLOWED_VIDEOS=["video/mp4","video/webm","video/quicktime"];

export const CITIZEN_VIDEO_MAX_SECONDS=10;
export function getVideoDuration(file:File):Promise<number>{
 return new Promise((resolve,reject)=>{const v=document.createElement("video");v.preload="metadata";const url=URL.createObjectURL(file);v.onloadedmetadata=()=>{URL.revokeObjectURL(url);resolve(v.duration)};v.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Vidéo illisible."))};v.src=url;});
}
export async function uploadReportMedia(reportId:string,file:File){
 if(!supabase)throw new Error("Supabase n’est pas configuré.");
 const isVideo=ALLOWED_VIDEOS.includes(file.type);
 if(!ALLOWED_IMAGES.includes(file.type)&&!isVideo)throw new Error("Type de fichier non autorisé. Utilisez JPG, PNG, WebP ou une vidéo MP4/WebM/MOV.");
 if(!isVideo&&file.size>MAX_IMAGE_SIZE)throw new Error("Photo trop volumineuse. Maximum : 8 Mo.");
 if(isVideo&&file.size>50*1024*1024)throw new Error("Vidéo trop volumineuse. Maximum : 50 Mo.");
 const ext=file.name.split(".").pop()?.toLowerCase()||(isVideo?"mp4":"jpg");
 const path=reportId+"/"+crypto.randomUUID()+"."+ext;
 const {error}=await supabase.storage.from("report-media").upload(path,file,{contentType:file.type,upsert:false});
 if(error)throw error;
 const {data:{user}}=await supabase.auth.getUser();
 const {error:rowError}=await supabase.from("report_media").insert({report_id:reportId,storage_path:path,media_type:file.type,file_size:file.size,uploaded_by:user?.id??null,media_role:"citizen_evidence",moderation_status:isVideo?"pending":"approved"});
 if(rowError){await supabase.storage.from("report-media").remove([path]);throw rowError;}
 return path;
}
export async function createReportMediaUrl(path:string,expiresIn=3600){
 if(!supabase)throw new Error("Supabase n’est pas configuré.");
 const {data,error}=await supabase.storage.from("report-media").createSignedUrl(path,expiresIn);
 if(error)throw error;
 return data.signedUrl;
}
export async function uploadResolutionVideo(reportId:string,file:File,latitude:number,longitude:number,accuracyM?:number){
 if(!supabase)throw new Error("Supabase n’est pas configuré.");
 if(!ALLOWED_VIDEOS.includes(file.type))throw new Error("Vidéo MP4, WebM ou MOV requise.");
 if(file.size>50*1024*1024)throw new Error("Vidéo trop volumineuse. Maximum : 50 Mo.");
 if(accuracyM!=null&&accuracyM>20)throw new Error("La précision GPS doit être de 20 mètres ou moins.");
 const ext=file.name.split(".").pop()?.toLowerCase()||"mp4";
 const path=reportId+"/resolution-"+crypto.randomUUID()+"."+ext;
 const {error}=await supabase.storage.from("report-media").upload(path,file,{contentType:file.type,upsert:false});
 if(error)throw error;
 const {data:{user}}=await supabase.auth.getUser();
 const {data:row,error:rowError}=await supabase.from("report_media").insert({report_id:reportId,storage_path:path,media_type:file.type,file_size:file.size,uploaded_by:user?.id??null,media_role:"resolution_video",moderation_status:"approved",captured_latitude:latitude,captured_longitude:longitude} as any).select("id").single();
 if(rowError){await supabase.storage.from("report-media").remove([path]);throw rowError;}
 return row.id as string;
}