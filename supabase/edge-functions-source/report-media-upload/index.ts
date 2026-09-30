import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_VIDEO_SIZE=50*1024*1024;
const ALLOWED_TYPES=new Set(["video/mp4","video/webm","video/quicktime"]);
const EXTENSIONS:Record<string,string[]>={
  "video/mp4":["mp4","m4v"],
  "video/webm":["webm"],
  "video/quicktime":["mov","qt"],
};
const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

function u32(b:Uint8Array,o:number){return (((b[o]<<24)>>>0)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3])>>>0}
function u64(b:Uint8Array,o:number){let n=0;for(let i=0;i<8;i++)n=n*256+b[o+i];return n}
function typeAt(b:Uint8Array,o:number){return String.fromCharCode(b[o],b[o+1],b[o+2],b[o+3])}

function findMvhdDuration(b:Uint8Array,start:number,end:number):number|null{
  let p=start;
  while(p+8<=end){
    let size=u32(b,p),header=8;
    if(size===1){if(p+16>end)return null;size=u64(b,p+8);header=16}
    if(size===0)size=end-p;
    if(size<header||p+size>end)return null;
    const t=typeAt(b,p+4);
    if(t==="mvhd"){
      const base=p+header;
      if(base+20>p+size)return null;
      const version=b[base];
      if(version===0){
        const timescale=u32(b,base+12);
        const duration=u32(b,base+16);
        return timescale>0?duration/timescale:null;
      }
      if(version===1){
        if(base+32>p+size)return null;
        const timescale=u32(b,base+20);
        const duration=u64(b,base+24);
        return timescale>0?duration/timescale:null;
      }
      return null;
    }
    if(t==="moov")return findMvhdDuration(b,p+header,p+size);
    p+=size;
  }
  return null;
}

function parseMp4Duration(b:Uint8Array):number|null{
  return findMvhdDuration(b,0,b.length);
}

function ebmlVint(b:Uint8Array,o:number):{value:number;length:number;unknown:boolean}|null{
  if(o>=b.length)return null;
  const first=b[o];
  let mask=0x80,len=1;
  while(len<=8&&(first&mask)===0){mask>>=1;len++}
  if(len>8||o+len>b.length)return null;
  let value=first&(~mask);
  for(let i=1;i<len;i++)value=value*256+b[o+i];
  const unknown=value===Math.pow(2,7*len)-1;
  return {value,length:len,unknown};
}

function findWebmDuration(b:Uint8Array):number|null{
  const ids=[
    [0x2a,0xd7,0xb1], // TimecodeScale
    [0x44,0x89],      // Duration
  ];
  let scale=1000000;
  let duration:number|null=null;
  for(let i=0;i<b.length-4;i++){
    if(b[i]===ids[0][0]&&b[i+1]===ids[0][1]&&b[i+2]===ids[0][2]){
      const size=ebmlVint(b,i+3);
      if(size&&size.value>0&&i+3+size.length+size.value<=b.length){
        let value=0;for(let j=0;j<size.value;j++)value=value*256+b[i+3+size.length+j];
        if(value>0)scale=value;
      }
    }
    if(i<b.length-2&&b[i]===ids[1][0]&&b[i+1]===ids[1][1]){
      const size=ebmlVint(b,i+2);
      if(size&&size.value>0&&size.value<=8&&i+2+size.length+size.value<=b.length){
        const o=i+2+size.length;
        if(size.value===4){
          const view=new DataView(b.buffer,b.byteOffset+o,4);duration=view.getFloat32(0,false);
        }else if(size.value===8){
          const view=new DataView(b.buffer,b.byteOffset+o,8);duration=view.getFloat64(0,false);
        }
      }
    }
  }
  return duration!=null&&Number.isFinite(duration)?duration*scale/1e9:null;
}

async function inspectVideo(file:File){
  if(!ALLOWED_TYPES.has(file.type))throw new Error("Type vidéo non autorisé.");
  if(file.size<=0||file.size>MAX_VIDEO_SIZE)throw new Error("Vidéo trop volumineuse. Maximum : 50 Mo.");
  const ext=(file.name.split(".").pop()??"").toLowerCase();
  if(!(EXTENSIONS[file.type]??[]).includes(ext))throw new Error("L’extension ne correspond pas au type MIME déclaré.");
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes.length!==file.size)throw new Error("Fichier vidéo incomplet.");
  let container:"mp4"|"webm"|null=null;
  if(bytes.length>=4&&bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3)container="webm";
  else if(bytes.length>=12&&bytes[4]===0x66&&bytes[5]===0x74&&bytes[6]===0x79&&bytes[7]===0x70)container="mp4";
  if(!container)throw new Error("Format vidéo réel non reconnu.");
  if((file.type==="video/webm"&&container!=="webm")||(file.type!=="video/webm"&&container!=="mp4"))throw new Error("Le contenu réel ne correspond pas au type déclaré.");
  const duration=container==="mp4"?parseMp4Duration(bytes):findWebmDuration(bytes);
  if(duration==null||!Number.isFinite(duration)||duration<=0)throw new Error("Durée réelle de la vidéo indéterminable.");
  if(duration>10.25)throw new Error("La vidéo dépasse la limite serveur de 10 secondes.");
  return {duration,container};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Méthode non autorisée."},405);
  const url=Deno.env.get("SUPABASE_URL")!;
  const anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader=req.headers.get("Authorization");
  if(!authHeader)return json({error:"Authentification requise."},401);
  const auth=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false},global:{headers:{Authorization:authHeader}}});
  const {data:{user},error:userError}=await auth.auth.getUser();
  if(userError||!user)return json({error:"Session invalide."},401);
  const form=await req.formData().catch(()=>null);
  const reportId=String(form?.get("report_id")??"").trim();
  const raw=form?.get("file");
  if(!reportId||!(raw instanceof File))return json({error:"Signalement et vidéo requis."},400);
  const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:report,error:reportError}=await admin.from("reports").select("id,citizen_id").eq("id",reportId).maybeSingle();
  if(reportError||!report)return json({error:"Signalement introuvable."},404);
  if(report.citizen_id!==user.id)return json({error:"Vous n’êtes pas autorisé à ajouter une vidéo à ce signalement."},403);
  let inspection;
  try{inspection=await inspectVideo(raw)}catch(error){return json({error:error instanceof Error?error.message:"Vidéo non conforme."},400)}
  const ext=(raw.name.split(".").pop()??"mp4").toLowerCase();
  const path=reportId+"/"+crypto.randomUUID()+"."+ext;
  const {error:uploadError}=await admin.storage.from("report-media").upload(path,raw,{contentType:raw.type,upsert:false});
  if(uploadError)return json({error:"Échec du stockage sécurisé de la vidéo."},500);
  const {data:row,error:rowError}=await admin.from("report_media").insert({
    report_id:reportId,storage_path:path,media_type:raw.type,file_size:raw.size,uploaded_by:user.id,
    media_role:"citizen_evidence",moderation_status:"pending"
  }).select("id").single();
  if(rowError){
    await admin.storage.from("report-media").remove([path]);
    return json({error:"Impossible d’enregistrer la vidéo du signalement."},500);
  }
  return json({success:true,media_id:row.id,storage_path:path,duration:inspection.duration,container:inspection.container});
});
