import {MediaCarousel} from "../components/MediaCarousel";
import {useEffect,useState} from "react";
import {useParams,Link} from "@/pcs/router";
import {supabase} from "../lib/supabase";
import {createReportMediaUrls} from "../services/media";
import {listReportComments} from "../services/admin";
import {canOperate,getMyRoles} from "../services/permissions";
import {statusLabels,type Report,type ReportStatus} from "../types";

type History={id:string;old_status:ReportStatus|null;new_status:ReportStatus;reason:string|null;created_at:string};
type Media={id:string;storage_path:string;media_role:string;media_type:string;moderation_status:string};
type Comment={id:string;body:string;created_at:string;author_id:string};

export default function ReportDetail(){
 const {id}=useParams();const [r,setR]=useState<Report|null>(null);const [history,setHistory]=useState<History[]>([]);const [media,setMedia]=useState<{id:string;url:string;media_role:string;media_type:string}[]>([]);const [comments,setComments]=useState<Comment[]>([]);const [showOps,setShowOps]=useState(false);const [error,setError]=useState("");
 useEffect(()=>{
  if(typeof window==="undefined")return;
  const standalone=window.matchMedia("(display-mode: standalone)").matches||window.matchMedia("(display-mode: fullscreen)").matches||("standalone"in navigator&&(navigator as Navigator & {standalone?:boolean}).standalone===true);
  if(standalone||localStorage.getItem("pcs_pwa_installed_v1")==="true")return;
  localStorage.setItem("pcs-pending-deeplink-v1",JSON.stringify({
    path:window.location.pathname,
    createdAt:Date.now(),
  }));
 },[]);
 useEffect(()=>{(async()=>{if(!supabase||!id){setError("Signalement introuvable.");return}const [reportRes,historyRes,mediaRes,roles]=await Promise.all([supabase.from("public_reports").select("*").eq("id",id).single(),supabase.from("public_report_status_history").select("id,old_status,new_status,reason,created_at").eq("report_id",id).order("created_at",{ascending:true}),supabase.from("public_report_media").select("id,storage_path,media_role,media_type,moderation_status").eq("report_id",id).order("created_at",{ascending:true}),getMyRoles()]);if(reportRes.error){setError("Signalement introuvable ou inaccessible.");return}setR(reportRes.data as Report);const staff=canOperate(roles);setShowOps(staff);if(!historyRes.error)setHistory((historyRes.data??[]) as History[]);if(!mediaRes.error){const approvedMedia=((mediaRes.data??[]) as Media[]).filter(m=>Boolean(m.id)&&Boolean(m.storage_path)&&m.moderation_status==="approved"&&(m.media_role==="citizen_evidence"||m.media_role==="resolution_video"));const signedUrls=await createReportMediaUrls(approvedMedia.map(m=>m.storage_path));setMedia(approvedMedia.flatMap(m=>{const url=signedUrls[m.storage_path];return url?[{id:m.id,url,media_role:m.media_role,media_type:m.media_type}]:[]}))}if(staff)setComments(await listReportComments(id) as Comment[])})().catch(e=>setError(e instanceof Error?e.message:"Impossible de charger le signalement."))},[id]);
 if(error)return <section className="narrow"><div className="card error">{error}</div><Link to="/">Retour à l’accueil</Link></section>;if(!r)return <section className="narrow"><div className="card">Chargement…</div></section>;
 return <section className="narrow"><Link to="/">← Accueil</Link><div className="card detail"><div className="row"><strong>{r.reference_code}</strong><span className="badge">{statusLabels[r.status]}</span></div><h1>{r.title}</h1><hr/><p><strong>Localisation :</strong> {r.location_label??"Non renseignée"}</p><p><strong>Priorité :</strong> {r.priority}</p><p><strong>Créé le :</strong> {new Date(r.created_at).toLocaleString("fr-FR")}</p>{r.resolved_at&&<p><strong>Résolu le :</strong> {new Date(r.resolved_at).toLocaleString("fr-FR")}</p>}{r.resolution_note&&<p><strong>Note de résolution :</strong> {r.resolution_note}</p>}</div>{media.length>0&&<div className="card"><h2>Preuves et résolution</h2><MediaCarousel media={media}/></div>}<div className="card"><h2>Historique</h2>{history.length===0?<p>Aucun changement de statut enregistré.</p>:<ol>{history.map(h=><li key={h.id}><strong>{statusLabels[h.new_status]}</strong> — {new Date(h.created_at).toLocaleString("fr-FR")}{h.reason&&<div>{h.reason}</div>}</li>)}</ol>}</div>{showOps&&<div className="card"><h2>Notes internes</h2>{comments.length===0?<p>Aucune note interne.</p>:comments.map(c=><article key={c.id}><p>{c.body}</p><small>{new Date(c.created_at).toLocaleString("fr-FR")}</small></article>)}</div>}</section>;
}
