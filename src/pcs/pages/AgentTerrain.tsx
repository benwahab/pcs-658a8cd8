import {useEffect,useRef,useState} from "react";
import {Link, useNavigate} from "@/pcs/router";
import {supabase} from "../lib/supabase";
import {listMyMissions,confirmFieldVerification,resolveMissionWithVideo} from "../services/mairie";
import BrandLogo from "../components/BrandLogo";
import {statusLabels} from "../types";
import {getSession,getMyRoles} from "../services/permissions";

import {
 cacheAgentMissions,
 clearCachedAgentMissions,
 getCachedAgentMissions,
 queueFieldVerification,
 flushFieldVerifications,
 pendingFieldVerificationCount,
 queueResolutionVideo,
 flushResolutionVideos,
 pendingResolutionVideoCount
} from "../services/offline";

export default function AgentTerrain(){
 const navigate=useNavigate();
 const [missions,setMissions]=useState<any[]>([]);
 const [agentUserId,setAgentUserId]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [offlinePending,setOfflinePending]=useState(0);
 const [verifyId,setVerifyId]=useState<string|null>(null);
 const [videoId,setVideoId]=useState<string|null>(null);
 const [video,setVideo]=useState<File|null>(null);
 const [cameraError,setCameraError]=useState(""),[videoPreviewUrl,setVideoPreviewUrl]=useState("");
 const previewRef=useRef<HTMLVideoElement|null>(null),previewUrlRef=useRef("");
 const [busy,setBusy]=useState(false);
 const [index,setIndex]=useState(0);

 async function logout(){
  setError("");
  if(offlinePending>0){
   setError("Vous avez des éléments hors connexion en attente. Reconnectez-vous et synchronisez-les avant de vous déconnecter, afin de ne perdre aucune preuve de mission.");
   return;
  }
  setBusy(true);
  try{
   if(!supabase)throw new Error("Service de connexion indisponible.");
   const {error:signOutError}=await supabase.auth.signOut();
   if(signOutError)throw signOutError;
   if(agentUserId)clearCachedAgentMissions(agentUserId);
   navigate("/connexion-operationnelle?mode=agent");
  }catch(e){
   setError(e instanceof Error?e.message:"La déconnexion a échoué. Réessayez.");
  }finally{
   setBusy(false);
  }
 }

 async function load(){
  try{
   const data=await listMyMissions();
   setMissions(data);
   if(agentUserId)cacheAgentMissions(agentUserId,data);
   setError("");
  }catch(e){
   const cached=agentUserId?getCachedAgentMissions(agentUserId):[];
   if(cached.length){
    setMissions(cached);
    setError("Mode hors connexion : missions précédemment chargées.");
   }else{
    setError(e instanceof Error?e.message:"Impossible de charger les missions hors connexion.");
   }
  }
  setOfflinePending(
   (await (agentUserId?pendingFieldVerificationCount(agentUserId):Promise.resolve(0)).catch(()=>0))+
   (await (agentUserId?pendingResolutionVideoCount(agentUserId):Promise.resolve(0)).catch(()=>0))
  );
 }

 async function syncPending(){
  if(!navigator.onLine)return;
  let failed=0;
  try{
   const verifications=await flushFieldVerifications(agentUserId!,async item=>{
    await confirmFieldVerification(
     item.reportId,item.latitude,item.longitude,item.accuracy
    );
   });
   failed+=verifications.failed;
   const videos=await flushResolutionVideos(agentUserId!,async item=>{
    const file=new File([item.video],item.fileName,{type:item.fileType});
    await resolveMissionWithVideo(
     item.reportId,file,item.latitude,item.longitude,item.accuracy
    );
   });
   failed+=videos.failed;
   await load();
   if(failed>0){
    setError(`Synchronisation incomplète : ${failed} élément(s) restent en attente. Vérifiez la connexion puis actualisez.`);
   }
  }catch(e){
   await load();
   setError(e instanceof Error
    ?`Synchronisation impossible : ${e.message}`
    :"Synchronisation impossible. Les éléments restent en attente.");
  }
 }

 useEffect(()=>()=>{if(previewUrlRef.current)URL.revokeObjectURL(previewUrlRef.current);},[]);
 useEffect(()=>{if(previewRef.current&&videoPreviewUrl)previewRef.current.src=videoPreviewUrl;},[videoPreviewUrl]);
 useEffect(()=>{
  let active=true;
  (async()=>{
   const session=await getSession();
   if(!session){
    if(active)navigate("/connexion-operationnelle?mode=agent");
    return;
   }
   const metadataRole=session.user.user_metadata?.role;
   if(navigator.onLine){
    try{
     const roles=await getMyRoles();
     if(!roles.includes("agent_terrain")){
      if(active)navigate("/connexion-operationnelle?mode=agent");
      return;
     }
     if(!supabase){
      if(active)navigate("/connexion-operationnelle?mode=agent");
      return;
     }
     const {data:agent,error:agentError}=await supabase
      .from("field_agents")
      .select("is_active")
      .eq("user_id",session.user.id)
      .maybeSingle();
     if(agentError||!agent?.is_active){
      if(active)navigate("/connexion-operationnelle?mode=agent");
      return;
     }
    }catch{
     if(metadataRole!=="agent_terrain"){
      if(active)navigate("/connexion-operationnelle?mode=agent");
      return;
     }
    }
   }else if(metadataRole!=="agent_terrain"){
    if(active)navigate("/connexion-operationnelle?mode=agent");
    return;
   }
   if(!active)return;
   setAgentUserId(session.user.id);
  })();
  return()=>{active=false;};
 },[navigate]);

 useEffect(()=>{
  if(!agentUserId)return;
  void load();
  void syncPending();
  window.addEventListener("online",syncPending);
  return()=>window.removeEventListener("online",syncPending);
 },[agentUserId]);

 function route(lat:number|null,lng:number|null){
  if(lat===null||lng===null)return;
  window.open(
   "https://www.google.com/maps/dir/?api=1&destination="+lat+","+lng,
   "_blank"
  );
 }

 function locateVerification(reportId:string){
  setError("");
  setBusy(true);
  navigator.geolocation.getCurrentPosition(async p=>{
   const payload={
    reportId,
    latitude:p.coords.latitude,
    longitude:p.coords.longitude,
    accuracy:p.coords.accuracy??null
   };
   try{
    if(payload.accuracy===null||payload.accuracy>20){
     throw new Error("La précision GPS doit être de 20 mètres ou moins.");
    }
    if(!navigator.onLine){
     await queueFieldVerification({agentId:agentUserId!,...payload});
     setOfflinePending(v=>v+1);
     setVerifyId(null);
     setError("Position enregistrée hors connexion. Elle sera transmise automatiquement dès que la connexion revient.");
     return;
    }
    await confirmFieldVerification(
     payload.reportId,payload.latitude,payload.longitude,payload.accuracy
    );
    setVerifyId(null);
    await load();
   }catch(e){
    if(!navigator.onLine){
     await queueFieldVerification({agentId:agentUserId!,...payload});
     setOfflinePending(v=>v+1);
     setVerifyId(null);
     setError("Connexion perdue : position enregistrée et mise en attente de synchronisation.");
    }else{
     setError(e instanceof Error?e.message:"Vérification impossible");
    }
   }finally{
    setBusy(false);
   }
  },()=>{
   setError("La localisation GPS précise est obligatoire pour confirmer le signalement.");
   setBusy(false);
  },{
   enableHighAccuracy:true,
   timeout:20000,
   maximumAge:0
  });
 }

 function cancelCapture(){
  setVideo(null);setCameraError("");setVideoId(null);
  if(previewUrlRef.current)URL.revokeObjectURL(previewUrlRef.current);
  previewUrlRef.current="";setVideoPreviewUrl("");
 }
 function resolve(m:any){
  if(!video){
   setError("Ajoutez la vidéo de résolution.");
   return;
  }
  setError("");
  setBusy(true);
  navigator.geolocation.getCurrentPosition(async p=>{
   const payload={
    reportId:m.reports.id,
    video,
    latitude:p.coords.latitude,
    longitude:p.coords.longitude,
    accuracy:p.coords.accuracy??null
   };
   try{
    if(payload.accuracy===null||payload.accuracy>20){
     throw new Error("La précision GPS doit être de 20 mètres ou moins.");
    }
    if(!navigator.onLine){
     await queueResolutionVideo({
      agentId:agentUserId!,
      reportId:payload.reportId,
      video:payload.video,
      fileName:payload.video.name,
      fileType:payload.video.type,
      latitude:payload.latitude,
      longitude:payload.longitude,
      accuracy:payload.accuracy
     });
     setVideoId(null);
     setVideo(null);
     setOfflinePending(v=>v+1);
     setError("Vidéo et position enregistrées hors connexion. Elles seront transmises automatiquement dès que la connexion revient.");
     return;
    }
    await resolveMissionWithVideo(
     payload.reportId,
     payload.video,
     payload.latitude,
     payload.longitude,
     payload.accuracy
    );
    setVideoId(null);
    setVideo(null);
    await load();
   }catch(e){
    if(!navigator.onLine){
     await queueResolutionVideo({
      agentId:agentUserId!,
      reportId:payload.reportId,
      video:payload.video,
      fileName:payload.video.name,
      fileType:payload.video.type,
      latitude:payload.latitude,
      longitude:payload.longitude,
      accuracy:payload.accuracy
     });
     setVideoId(null);
     setVideo(null);
     setOfflinePending(v=>v+1);
     setError("Connexion perdue : vidéo et position mises en attente de synchronisation.");
    }else{
     setError(e instanceof Error?e.message:"Validation impossible");
    }
   }finally{
    setBusy(false);
   }
  },()=>{
   setError("La localisation GPS précise est obligatoire pour publier la résolution.");
   setBusy(false);
  },{
   enableHighAccuracy:true,
   timeout:20000,
   maximumAge:0
  });
 }

 function next(){if(missions.length)setIndex(i=>Math.min(i+1,missions.length-1));}
 function prev(){if(missions.length)setIndex(i=>Math.max(i-1,0));}

 return <section className="agentFeed">
  <header className="agentFeedTop">
   <Link to="/" className="feedBrand"><BrandLogo className="agentBrandLogo"/></Link>
   <div>
    <strong>Mes missions</strong>
    <small>{missions.length} mission(s){offlinePending>0?` · ${offlinePending} en attente`: ""}</small>
   </div>
   <button className="agentRefresh" onClick={load} aria-label="Actualiser les missions" title="Actualiser">↻</button>
   <button className="agentLogout" onClick={logout} disabled={busy} style={{border:"1px solid #fecaca",borderRadius:10,padding:"8px 10px",background:"#fff",color:"#b91c1c",fontWeight:700,whiteSpace:"nowrap"}}>↪ Déconnexion</button>
  </header>
  {error&&<div className="agentFeedError">{error}<button onClick={()=>setError("")}>×</button></div>}
  {!missions.length&&!error?
   <div className="agentEmpty">
    <span>✓</span><h1>Aucune mission</h1>
    <p>Les missions attribuées par votre mairie apparaîtront ici.</p>
    <Link className="feedPrimary" to="/">Accueil</Link>
   </div>:
   missions.length>0&&<div className="agentMissionViewport">
    {missions.map((m,i)=>{
     const s=m.reports?.status;
     return <article className={`agentMissionSlide ${i===index?"current":""}`} key={m.id}>
      <div className="missionBackdrop"><div className="missionGlow"/></div>
      <div className="missionContent">
       <div className="missionMeta">
        <span>{m.reports?.reference_code}</span>
        <span className={`statusPill ${s==="verification"?"amber":s==="in_progress"?"violet":s==="resolved"?"violet":"slate"}`}>
         {statusLabels[s as keyof typeof statusLabels]??s}
        </span>
       </div>
       <h1>{m.reports?.title}</h1>
       <div className="missionLocation">
        <span>⌖</span>
        <div>
         <strong>{m.reports?.location_label??"Localisation GPS enregistrée"}</strong>
         <small>Position du signalement</small>
        </div>
       </div>
       <div className="missionActions">
        {m.reports?.latitude!=null&&
         <button onClick={()=>route(m.reports.latitude,m.reports.longitude)} className="feedActionButton">⌖ Itinéraire</button>}
        {s==="verification"&&
         <button className="feedActionButton primary" disabled={busy} onClick={()=>setVerifyId(m.reports.id)}>✓ Confirmer sur place</button>}
        {s==="in_progress"&&
         <button className="feedActionButton primary" disabled={busy} onClick={()=>{cancelCapture();setVideoId(m.id);}}>● Publier la résolution</button>}
       </div>
       {verifyId===m.reports?.id&&
        <div className="agentActionSheet">
         <strong>Confirmation terrain</strong>
         <p>Vous devez être physiquement à 20 mètres ou moins du lieu du signalement.</p>
         <button className="feedActionButton primary" disabled={busy} onClick={()=>locateVerification(m.reports.id)}>
          {busy?"Vérification GPS…":"Confirmer avec ma position GPS"}
         </button>
        </div>}
       {videoId===m.id&&
        <div className="agentActionSheet">
         <strong>Importer la vidéo de résolution</strong>
         {cameraError&&<p role="alert" style={{color:"#b91c1c"}}>{cameraError}</p>}
         {video&&videoPreviewUrl&&<><video ref={previewRef} controls playsInline style={{width:"100%",maxHeight:"42vh",borderRadius:12,background:"#111",objectFit:"contain"}}/><p>Vidéo prête ({(video.size/1024/1024).toFixed(1)} Mo).</p></>}
         <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"10px 0"}}>
          <button type="button" className="feedActionButton primary" disabled={busy} onClick={()=>document.getElementById("agent-resolution-video-import")?.click()}>{video?"Choisir une autre vidéo":"Choisir une vidéo"}</button>
          <input id="agent-resolution-video-import" hidden type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v" onChange={event=>{const file=event.target.files?.[0]??null;event.target.value="";if(!file)return;if(file.size<=0){setCameraError("Le fichier vidéo est vide.");return;}if(file.size>100*1024*1024){setCameraError("La vidéo ne doit pas dépasser 100 Mo.");return;}if(!["video/mp4","video/webm","video/quicktime"].includes(file.type)){setCameraError("Format vidéo non pris en charge. Utilisez MP4, WebM ou MOV.");return;}setCameraError("");setVideo(file);if(previewUrlRef.current)URL.revokeObjectURL(previewUrlRef.current);previewUrlRef.current=URL.createObjectURL(file);setVideoPreviewUrl(previewUrlRef.current);}} />
         </div>
         <p>Formats acceptés : MP4, WebM ou MOV. Taille maximale : 100 Mo, sans limite de durée. Une position GPS précise à 20 mètres ou moins du signalement reste requise.</p>
         <button className="feedActionButton primary" disabled={!video||busy} onClick={()=>resolve(m)}>{busy?"Envoi…":"Envoyer la vidéo de résolution"}</button>
         <button type="button" className="feedActionButton" disabled={busy} onClick={cancelCapture}>Annuler</button>
        </div>}
      </div>
      <div className="missionRail">
       <button onClick={()=>setError("La validation est enregistrée par le backend PCS.")}>✓<small>Traçabilité</small></button>
       <button onClick={()=>route(m.reports?.latitude,m.reports?.longitude)}>⌖<small>GPS</small></button>
       <button onClick={()=>setIndex(i)} className="railActive">#{i+1}<small>Mission</small></button>
      </div>
     </article>;
    })}
    <button className="missionPager prev" disabled={index===0} onClick={prev}>↑</button>
    <button className="missionPager next" disabled={index===missions.length-1} onClick={next}>↓</button>
   </div>}
  <div className="agentFeedBottom">
   <Link to="/agent-terrain" className="active"><span>▣</span><small>Missions</small></Link>
   <button onClick={load}><span>↻</span><small>Actualiser</small></button>
   <Link to="/" className="feedCreate"><span>⌂</span></Link>
   <Link to="/notifications"><span>♧</span><small>Alertes</small></Link>
   <Link to="/connexion-operationnelle?mode=agent"><span>♙</span><small>Compte</small></Link>
  </div>
 </section>;
}
