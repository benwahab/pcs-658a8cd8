import {useEffect,useRef,useState} from "react";
import {Link} from "@/pcs/router";
import {listMyMissions,confirmFieldVerification,resolveMissionWithVideo} from "../services/mairie";
import BrandLogo from "../components/BrandLogo";
import {statusLabels} from "../types";
import {MAX_VIDEO_SIZE_BYTES} from "../services/media";
import {
 cacheAgentMissions,
 getCachedAgentMissions,
 queueFieldVerification,
 flushFieldVerifications,
 pendingFieldVerificationCount,
 queueResolutionVideo,
 flushResolutionVideos,
 pendingResolutionVideoCount
} from "../services/offline";

export default function AgentTerrain(){
 const [missions,setMissions]=useState<any[]>(()=>getCachedAgentMissions());
 const [error,setError]=useState("");
 const [offlinePending,setOfflinePending]=useState(0);
 const [verifyId,setVerifyId]=useState<string|null>(null);
 const [videoId,setVideoId]=useState<string|null>(null);
 const [video,setVideo]=useState<File|null>(null);
 const [cameraReady,setCameraReady]=useState(false),[recording,setRecording]=useState(false),[elapsed,setElapsed]=useState(0);
 const [cameraError,setCameraError]=useState(""),[videoPreviewUrl,setVideoPreviewUrl]=useState("");
 const cameraRef=useRef<HTMLVideoElement|null>(null),previewRef=useRef<HTMLVideoElement|null>(null);
 const streamRef=useRef<MediaStream|null>(null),recorderRef=useRef<MediaRecorder|null>(null);
 const chunksRef=useRef<BlobPart[]>([]),timerRef=useRef<number|null>(null),previewUrlRef=useRef("");
 const [busy,setBusy]=useState(false);
 const [index,setIndex]=useState(0);

 async function load(){
  try{
   const data=await listMyMissions();
   setMissions(data);
   cacheAgentMissions(data);
   setError("");
  }catch(e){
   const cached=getCachedAgentMissions();
   if(cached.length){
    setMissions(cached);
    setError("Mode hors connexion : missions précédemment chargées.");
   }else{
    setError(e instanceof Error?e.message:"Impossible de charger les missions hors connexion.");
   }
  }
  setOfflinePending(
   (await pendingFieldVerificationCount().catch(()=>0))+
   (await pendingResolutionVideoCount().catch(()=>0))
  );
 }

 async function syncPending(){
  if(!navigator.onLine)return;
  await flushFieldVerifications(async item=>{
   await confirmFieldVerification(
    item.reportId,item.latitude,item.longitude,item.accuracy
   );
  });
  await flushResolutionVideos(async item=>{
   const file=new File([item.video],item.fileName,{type:item.fileType});
   await resolveMissionWithVideo(
    item.reportId,file,item.latitude,item.longitude,item.accuracy
   );
  });
  await load();
 }

 useEffect(()=>()=>{if(timerRef.current!==null)window.clearInterval(timerRef.current);if(recorderRef.current?.state==="recording")recorderRef.current.stop();streamRef.current?.getTracks().forEach(t=>t.stop());if(previewUrlRef.current)URL.revokeObjectURL(previewUrlRef.current);},[]);
 useEffect(()=>{
  if(cameraReady&&cameraRef.current&&streamRef.current){
   cameraRef.current.srcObject=streamRef.current;
   void cameraRef.current.play().catch(()=>setCameraError("Impossible d’afficher l’aperçu caméra."));
  }
 },[cameraReady]);
 useEffect(()=>{if(previewRef.current&&videoPreviewUrl)previewRef.current.src=videoPreviewUrl;},[videoPreviewUrl]);
 useEffect(()=>{
  void load();
  void syncPending();
  window.addEventListener("online",syncPending);
  return()=>window.removeEventListener("online",syncPending);
 },[]);

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
     await queueFieldVerification(payload);
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
     await queueFieldVerification(payload);
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

 function stopCamera(){
  if(timerRef.current!==null){window.clearInterval(timerRef.current);timerRef.current=null;}
  const r=recorderRef.current;if(r&&r.state!=="inactive"){try{r.stop();}catch{}}
  streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;recorderRef.current=null;
  if(cameraRef.current)cameraRef.current.srcObject=null;setCameraReady(false);setRecording(false);
 }
 function cancelCapture(){
  stopCamera();setVideo(null);setElapsed(0);setCameraError("");setVideoId(null);
  if(previewUrlRef.current)URL.revokeObjectURL(previewUrlRef.current);previewUrlRef.current="";setVideoPreviewUrl("");
 }
 async function openCamera(){
  setCameraError("");setVideo(null);setElapsed(0);
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){setCameraError("Ce navigateur ne prend pas en charge l’enregistrement vidéo par caméra. Utilisez un navigateur récent sur téléphone.");return;}
  try{
   stopCamera();let stream:MediaStream;
   try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:true});}
   catch(e){if(e instanceof DOMException&&(e.name==="NotFoundError"||e.name==="OverconstrainedError"))stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});else throw e;}
   streamRef.current=stream;if(cameraRef.current){cameraRef.current.srcObject=stream;await cameraRef.current.play();}setCameraReady(true);
  }catch(e){stopCamera();const n=e instanceof DOMException?e.name:"";setCameraError(n==="NotAllowedError"||n==="SecurityError"?"Accès caméra/micro refusé. Autorisez-les dans les réglages du navigateur.":n==="NotFoundError"?"Aucune caméra ou aucun microphone disponible.":n==="NotReadableError"?"La caméra est utilisée par une autre application. Fermez-la puis réessayez.":"Impossible d’ouvrir la caméra. Vérifiez les autorisations et utilisez PCS en HTTPS.");}
 }
 function startRecording(){
  const stream=streamRef.current;if(!stream){setCameraError("Ouvrez d’abord la caméra.");return;}
  const mime=["video/mp4","video/webm;codecs=vp8,opus","video/webm"].find(t=>MediaRecorder.isTypeSupported(t));
  if(!mime){setCameraError("Aucun format MP4/WebM compatible sur ce navigateur. Essayez un navigateur récent.");return;}
  chunksRef.current=[];setCameraError("");
  try{
   const r=new MediaRecorder(stream,{mimeType:mime});recorderRef.current=r;
   r.ondataavailable=e=>{if(e.data?.size){chunksRef.current.push(e.data);const total=chunksRef.current.reduce((sum,chunk)=>sum+(chunk instanceof Blob?chunk.size:chunk instanceof ArrayBuffer?chunk.byteLength:0),0);if(total>MAX_VIDEO_SIZE_BYTES&&r.state==="recording"){setCameraError("Limite de 100 Mo atteinte : arrêt automatique de l’enregistrement.");r.stop();}}};
   r.onerror=()=>setCameraError("Erreur d’enregistrement. Réessayez.");
   r.onstop=()=>{
    if(timerRef.current!==null){window.clearInterval(timerRef.current);timerRef.current=null;}setRecording(false);
    const blob=new Blob(chunksRef.current,{type:r.mimeType||mime});chunksRef.current=[];
    if(!blob.size){setCameraError("Vidéo vide. Réenregistrez.");stopCamera();return;}
    if(blob.size>MAX_VIDEO_SIZE_BYTES){setVideo(null);setCameraError("La vidéo ne doit pas dépasser 100 Mo. Réenregistrez avec une qualité ou une durée adaptée.");stopCamera();return;}
    const type=blob.type.split(";")[0].toLowerCase(),ext=type==="video/mp4"?"mp4":type==="video/webm"?"webm":"";
    if(!ext){setCameraError("Format produit non accepté par PCS. Essayez un autre navigateur.");stopCamera();return;}
    const file=new File([blob],"resolution-"+Date.now()+"."+ext,{type});if(previewUrlRef.current)URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current=URL.createObjectURL(file);setVideoPreviewUrl(previewUrlRef.current);setVideo(file);stopCamera();
   };
   r.start(1000);setRecording(true);setElapsed(0);
   timerRef.current=window.setInterval(()=>setElapsed(v=>v+1),1000);
  }catch{setCameraError("Impossible de démarrer l’enregistrement. Vérifiez les autorisations caméra.");}
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
   <button className="agentRefresh" onClick={load}>↻</button>
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
        <span className={`statusPill ${s==="verification"?"amber":s==="in_progress"?"violet":s==="resolved"?"green":"slate"}`}>
         {statusLabels[s as keyof typeof statusLabels]??s}
        </span>
       </div>
       <h1>{m.reports?.title}</h1>
       <p>{m.reports?.description}</p>
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
         <strong>Résolution vidéo — caméra obligatoire</strong>
         {cameraError&&<p role="alert" style={{color:"#b91c1c"}}>{cameraError}</p>}
         {!cameraReady&&!video&&<button type="button" className="feedActionButton primary" disabled={busy} onClick={openCamera}>Ouvrir la caméra</button>}
         {cameraReady&&!recording&&!video&&<video ref={cameraRef} autoPlay muted playsInline style={{width:"100%",maxHeight:"42vh",borderRadius:12,background:"#111",objectFit:"cover"}}/>}
         {cameraReady&&!recording&&!video&&<button type="button" className="feedActionButton primary" onClick={startRecording}>● Démarrer l’enregistrement</button>}
         {recording&&<><video ref={cameraRef} autoPlay muted playsInline style={{width:"100%",maxHeight:"42vh",borderRadius:12,background:"#111",objectFit:"cover"}}/><p>Enregistrement : {Math.floor(elapsed/60).toString().padStart(2,"0")}:{String(elapsed%60).padStart(2,"0")}</p><button type="button" className="feedActionButton primary" onClick={()=>recorderRef.current?.state==="recording"&&recorderRef.current.stop()}>■ Arrêter et prévisualiser</button></>}
         {video&&videoPreviewUrl&&<><video ref={previewRef} controls playsInline style={{width:"100%",maxHeight:"42vh",borderRadius:12,background:"#111",objectFit:"contain"}}/><p>Vidéo prête ({(video.size/1024/1024).toFixed(1)} Mo).</p><button type="button" className="feedActionButton" disabled={busy} onClick={()=>{setVideo(null);URL.revokeObjectURL(previewUrlRef.current);previewUrlRef.current="";setVideoPreviewUrl("");void openCamera();}}>Réenregistrer</button></>}
         <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"10px 0"}}><button type="button" className="feedActionButton" disabled={busy||recording} onClick={()=>document.getElementById("agent-resolution-video-import")?.click()}>Importer une vidéo</button><input id="agent-resolution-video-import" hidden type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v" onChange={event=>{const file=event.target.files?.[0]??null;event.target.value="";if(!file)return;if(file.size<=0||file.size>MAX_VIDEO_SIZE_BYTES){setCameraError("La vidéo ne doit pas dépasser 100 Mo.");return;}if(!["video/mp4","video/webm","video/quicktime"].includes(file.type)){setCameraError("Format vidéo non pris en charge. Utilisez MP4, WebM ou MOV.");return;}setCameraError("");setVideo(file);if(previewUrlRef.current)URL.revokeObjectURL(previewUrlRef.current);previewUrlRef.current=URL.createObjectURL(file);setVideoPreviewUrl(previewUrlRef.current);stopCamera();}} /></div><p>Durée non limitée par PCS. Taille maximale : 100 Mo. GPS précis requis à 20 mètres ou moins du signalement.</p>
         <button className="feedActionButton primary" disabled={!video||busy||recording} onClick={()=>resolve(m)}>{busy?"Publication…":"Publier la résolution"}</button>
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
