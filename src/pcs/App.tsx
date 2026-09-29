import {useEffect,useState} from "react";
import type {FormEvent} from "react";
import {Link,useLocation,useNavigate} from "@/pcs/router";
import {supabase,isSupabaseConfigured} from "./lib/supabase";
import {createReport,listCategories,listMyReports,listPublicReports} from "./lib/reports";
import type {Category,PublicReport,Report} from "./types";
import {statusLabels} from "./types";
import Admin from "./pages/Admin";
import ReportDetail from "./pages/ReportDetail";
import Notifications from "./pages/Notifications";
import Dashboard from "./pages/Dashboard";
import Moderation from "./pages/Moderation";
import {getMyOrganizationMembership} from "./services/organization";
import {canOperate,getMyRoles,type AppRole} from "./services/permissions";
import {uploadReportMedia,createReportMediaUrl,getVideoDuration,CITIZEN_VIDEO_MAX_SECONDS} from "./services/media";
export function MediaCarousel({media}:{media:{id:string;url:string;media_type:string;media_role?:string}[]}){
 if(!media.length)return null;
 return <div className="mediaCarousel">{media.map((m,i)=><div className="mediaCarouselItem" key={m.id}>{m.media_type?.startsWith("video")||m.media_role==="resolution_video"?<video src={m.url} controls playsInline preload="metadata"/>:<img src={m.url} alt="Pièce jointe du signalement"/>}{media.length>1&&<span className="mediaCount">{i+1}/{media.length}</span>}</div>)}</div>;
}
import {listRegions,listCommunes,signupMairie,loginAgent,lookupAgentByPhone,getMyMairie} from "./services/mairie";
import MairieDashboard from "./pages/MairieDashboard";
import AgentTerrain from "./pages/AgentTerrain";
import OrganizationDashboard from "./pages/OrganizationDashboard";
import OnboardingTour from "./components/OnboardingTour";
import BrandLogo from "./components/BrandLogo";
import {url as pcsLogoUrl} from "@/assets/pcs-logo.png.asset.json";

function PasswordField({label,value,onChange,confirmation=false,visible,onToggle}:{label:string;value:string;onChange:(value:string)=>void;confirmation?:boolean;visible:boolean;onToggle:()=>void}){
 return <label>{label}<span className="passwordField"><input required minLength={8} type={visible?"text":"password"} value={value} onChange={e=>onChange(e.target.value)} autoComplete={confirmation?"new-password":"current-password"}/><button className="passwordToggle" type="button" onClick={onToggle} aria-label={visible?"Masquer le mot de passe":"Afficher le mot de passe"} title={visible?"Masquer le mot de passe":"Afficher le mot de passe"}>{visible?"◉":"◎"}</button></span></label>
}

export function Shell({children}:{children:React.ReactNode}){
 const [email,setEmail]=useState<string|null>(null);const [roles,setRoles]=useState<AppRole[]>([]);
 const navigate=useNavigate();
 const location=useLocation();
 const isMairie=location.pathname==="/mairie";
 useEffect(()=>{
  if(!supabase)return;
  supabase.auth.getUser().then(({data})=>setEmail(data.user?.email??null));
  getMyRoles().then(setRoles).catch(()=>setRoles([]));
  const {data:{subscription}}=supabase.auth.onAuthStateChange(async(_event,session)=>{
   setEmail(session?.user?.email??null);
   if(session)setRoles(await getMyRoles().catch(()=>[])); else setRoles([]);
  });
  return()=>subscription.unsubscribe();
 },[]);
 async function logout(){await supabase?.auth.signOut();setEmail(null);setRoles([]);navigate("/");}
 if(isMairie)return <div className="app mairieApp">{children}</div>;
 return <div className="app"><header><Link className="brand" to="/"><BrandLogo className="brandLogo"/></Link><nav data-pcs-tour="app-nav"><Link to="/">Accueil</Link></nav><span className="session" data-pcs-tour="account">{email?<><span>{email}</span><button className="button" onClick={logout}>Déconnexion</button></>:"Visiteur"}</span></header><main>{children}</main><footer>PCS — Plateforme de Citoyenneté et de Signalement</footer></div>
}

export function Home(){
 const [reports,setReports]=useState<PublicReport[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 useEffect(()=>{listPublicReports().then(setReports).catch(e=>setError(e instanceof Error?e.message:"Impossible de charger les signalements publics.")).finally(()=>setLoading(false))},[]);
 return <section className="citizenFeed">
   <div className="citizenFeedTop"><Link className="feedBrand" data-pcs-tour="home" to="/"><BrandLogo className="feedBrandLogo"/></Link><div className="feedTabs"><span className="active">Tous les signalements</span></div><details className="feedAccess" data-pcs-tour="professional-access"><summary><span className="feedAccessIcon">◈</span><span>Espace professionnel</span><span className="feedAccessChevron">▾</span></summary><div><Link to="/connexion-operationnelle">🏛️ Mairie</Link><Link to="/connexion-operationnelle?mode=agent">👷 Agent terrain</Link><Link to="/connexion-nigelec">⚡ NIGELEC</Link><Link to="/connexion-nde">💧 NDE</Link></div></details></div>
   <article className="citizenSlide citizenSlideIntro"><div className="slideShade"/><div className="slideContent"><p className="eyebrow feedEyebrow">PLATEFORME CITOYENNE</p><h1>Les problèmes publics,<br/><strong>visibles et suivis.</strong></h1><p>Parcourez les signalements publiés dans tout le Niger, suivez leur évolution et consultez les résolutions.</p><div className="feedActions"><Link className="feedPrimary" data-pcs-tour="create-report" to="/signaler">＋ Signaler un problème</Link></div></div></article>
  {error&&<article className="citizenSlide"><div className="slideContent"><p className="error">{error}</p></div></article>}
  {loading&&<article className="citizenSlide"><div className="slideContent"><p>Chargement des signalements…</p></div></article>}
  {!loading&&reports.length===0&&!error&&<article className="citizenSlide"><div className="slideContent"><h2>Aucun signalement public pour le moment.</h2><p>Les signalements publiés apparaîtront ici au fur et à mesure.</p></div></article>}
  {reports.map(r=><PublicReportSlide key={r.id} report={r}/>)}
 </section>
}
function PublicReportSlide({report}:{report:PublicReport}){
 const [media,setMedia]=useState<{id:string;url:string;media_role:string;media_type:string}[]>([]);
 useEffect(()=>{if(!supabase||!report.id){setMedia([]);return}const reportId=report.id;void (async()=>{try{const {data,error}=await supabase.from("public_report_media").select("id,storage_path,media_role,media_type").eq("report_id",reportId).order("created_at",{ascending:true});if(error)throw error;const urls=(await Promise.all((data??[]).filter(m=>m.id&&m.storage_path).map(async m=>({id:m.id as string,url:await createReportMediaUrl(m.storage_path as string),media_role:m.media_role??"evidence",media_type:m.media_type??"image"}))));setMedia(urls)}catch{setMedia([])}})()},[report.id]);
 return <article className="citizenSlide citizenSlideTrack"><div className="slideContent">
  <p className="eyebrow feedEyebrow">{report.status ? statusLabels[report.status] : "Signalement"}</p><div className="row"><strong>{report.reference_code ?? "PCS"}</strong><span className="badge" data-pcs-tour="status">{report.priority ? report.priority : "normal"}</span></div><h2>{report.title}</h2><p>{report.description}</p>
  {report.location_label&&<p><strong>📍</strong> {report.location_label}</p>}
  {report.resolution_note&&<p><strong>Résolution :</strong> {report.resolution_note}</p>}
  <MediaCarousel media={media}/>
  <Link className="feedPrimary" to={report.id ? "/signalement/"+report.id : "/"}>Voir le signalement</Link>
 </div></article>
}
export function Auth(){
 const [email,setEmail]=useState("");const [sent,setSent]=useState(false);const [error,setError]=useState("");
 async function submit(e:FormEvent){e.preventDefault();setError("");if(!supabase){setError("Le backend Supabase n’est pas configuré.");return}const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin}});if(error)setError(error.message);else setSent(true)}
 return <section className="narrow authScreen"><h1>Connexion</h1>{sent?<div className="card">Un lien de connexion a été envoyé à <strong>{email}</strong>.</div>:{pending?<div className="card"><h2>Demande reçue</h2><p>Votre demande de création de compte mairie a bien été enregistrée.</p><p>Le compte sera activé après validation de l’habilitation de la mairie.</p><button type="button" className="button" onClick={()=>{setPending(false);setSignup(false);setError("");setIdentifier("");setPw("");setConfirmPw("");}}>Retour à la connexion</button></div>:<form className="card form" onSubmit={submit}><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>{error&&<p className="error">{error}</p>}<button className="button primary" type="submit">Recevoir le lien</button></form>}</section>
}

export function OperationalLogin(){
 const[mode,setMode]=useState<"mairie"|"agent"|"org">(()=>{const m=new URLSearchParams(window.location.search).get("mode");return m==="agent"?"agent":"mairie"});
 const[identifier,setIdentifier]=useState("");const[pw,setPw]=useState("");const[confirmPw,setConfirmPw]=useState("");const[showPw,setShowPw]=useState(false);const[name,setName]=useState("");const[mayorName,setMayorName]=useState("");const[region,setRegion]=useState("");const[commune,setCommune]=useState("");const[communes,setCommunes]=useState<any[]>([]);const[mairieCoords,setMairieCoords]=useState<{lat:number;lng:number}|null>(null);const[regions,setRegions]=useState<any[]>([]);const[signup,setSignup]=useState(false);const[agent,setAgent]=useState<any>(null);const[agentChallenge,setAgentChallenge]=useState("");const[error,setError]=useState("");const[busy,setBusy]=useState(false);const[pending,setPending]=useState(false);const nav=useNavigate();
 useEffect(()=>{listRegions().then(setRegions).catch(e=>setError(e.message))},[]);
 useEffect(()=>{setCommune("");if(region)listCommunes(region).then(setCommunes).catch(e=>setError(e.message));else setCommunes([])},[region]);
 async function identifyAgent(e:FormEvent){e.preventDefault();setError("");setBusy(true);try{const result=await lookupAgentByPhone(identifier);setAgent(result.agent);setAgentChallenge(result.challenge)}catch(e){setError(e instanceof Error?e.message:"Numéro non reconnu.")}finally{setBusy(false)}}
 async function submit(e:FormEvent){e.preventDefault();setError("");if(signup&&pw!==confirmPw){setError("Les deux mots de passe ne correspondent pas.");return}setBusy(true);try{if(!supabase){setError("Supabase non configuré.");return}if(signup){await signupMairie({name,region_id:region,commune_id:commune,email:identifier,password:pw,mayor_name:mayorName,latitude:mairieCoords?.lat,longitude:mairieCoords?.lng});setPending(true);return}if(mode==="agent"){if(!agentChallenge)throw new Error("Session de connexion agent manquante. Recommencez avec votre numéro.");await loginAgent(agentChallenge,pw);nav("/agent-terrain");return}const x=await supabase.auth.signInWithPassword({email:identifier,password:pw});if(x.error)throw x.error;const mairie=await getMyMairie();if(mairie?.is_active){nav("/mairie")}else{await supabase.auth.signOut();throw new Error("Votre demande mairie est en attente de validation. Le compte n’est pas encore activé.")}}catch(e){setError(e instanceof Error?e.message:"Connexion impossible")}finally{setBusy(false)}}
 if(mode==="agent"&&!agent)return <section className="narrow authScreen"><h1>Espace agent terrain</h1><p>Entrez votre numéro de téléphone professionnel pour vérifier votre compte.</p><form className="card form" onSubmit={identifyAgent}><label>Numéro de téléphone<input required type="tel" inputMode="tel" value={identifier} onChange={e=>setIdentifier(e.target.value)} autoComplete="tel" placeholder="+227 90 00 00 00"/></label>{error&&<p className="error">{error}</p>}<button className="button primary" disabled={busy}>{busy?"Vérification…":"Continuer"}</button></form><Link className="button" to="/">Retour</Link></section>;
 return <section className="narrow authScreen"><h1>{signup?"Créer le compte de la mairie":mode==="agent"?"Connexion agent terrain":"Connexion mairie"}</h1>{mode!=="agent"&&!signup&&<div className="actions"><button className="button primary" onClick={()=>{setMode("mairie");setError("")}}>Mairie</button><Link className="button" to="/connexion-operationnelle?mode=agent">Agent terrain</Link><Link className="button" to="/connexion-nigelec">NIGELEC</Link><Link className="button" to="/connexion-nde">NDE</Link></div>}{mode==="agent"&&agent&&<div className="card"><strong>{agent.first_name} {agent.last_name}</strong><p>Matricule : {agent.matricule}</p><p>Qualité : {agent.qualification}</p></div>}<form className="card form" onSubmit={submit}>{signup&&<><label>Nom de la mairie<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Mairie de Niamey"/></label><label>Nom du maire<input required value={mayorName} onChange={e=>setMayorName(e.target.value)} placeholder="Nom du maire"/></label><label>Région<select required value={region} onChange={e=>setRegion(e.target.value)}><option value="">Choisir…</option>{regions.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Mairie / localité<select required disabled={!region||!communes.length} value={commune} onChange={e=>setCommune(e.target.value)}><option value="">{region==="Niamey"?"Choisir Ville de Niamey…":"Choisir une localité…"}</option>{communes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button type="button" className="button" onClick={()=>navigator.geolocation?.getCurrentPosition(p=>setMairieCoords({lat:p.coords.latitude,lng:p.coords.longitude}),()=>setError("Impossible d’obtenir la position GPS de la mairie."),{enableHighAccuracy:true,timeout:10000,maximumAge:0})}>Utiliser la position GPS de la mairie</button>{mairieCoords&&<small>GPS : {mairieCoords.lat.toFixed(5)}, {mairieCoords.lng.toFixed(5)}</small>}</>}{mode!=="agent"&&<label>Email<input required type="email" value={identifier} onChange={e=>setIdentifier(e.target.value)}/></label>}<PasswordField label="Mot de passe" value={pw} onChange={setPw} visible={showPw} onToggle={()=>setShowPw(value=>!value)}/>{signup&&<PasswordField label="Confirmer le mot de passe" value={confirmPw} onChange={setConfirmPw} confirmation visible={showPw} onToggle={()=>setShowPw(value=>!value)}/>} {error&&<p className="error">{error}</p>}<button className="button primary" type="submit" disabled={busy}>{busy?"Connexion…":signup?"Créer la mairie":"Se connecter"}</button></form>}{mode==="mairie"&&<button className="button" onClick={()=>{setSignup(!signup);setError("");setIdentifier("");setPw("");setConfirmPw("");setShowPw(false)}}>{signup?"J’ai déjà un compte":"Créer un compte mairie"}</button>}{mode==="agent"&&<button className="button" onClick={()=>{setAgent(null);setAgentChallenge("");setError("");setPw("");setShowPw(false)}}>Changer de numéro</button>}</section>
}
export function ReportForm(){
 const nav=useNavigate();const [categories,setCategories]=useState<Category[]>([]);const [regions,setRegions]=useState<any[]>([]);const [region,setRegion]=useState("");const [commune,setCommune]=useState("");const [communes,setCommunes]=useState<any[]>([]);const [category,setCategory]=useState("");const [title,setTitle]=useState("");const [description,setDescription]=useState("");const [location,setLocation]=useState("");const [coords,setCoords]=useState<{lat:number;lng:number}|null>(null);const [files,setFiles]=useState<File[]>([]);const [video,setVideo]=useState<File|null>(null);const [error,setError]=useState("");const [saving,setSaving]=useState(false);
 useEffect(()=>{Promise.all([listCategories(),listRegions()]).then(([c,r])=>{setCategories(c);setRegions(r)}).catch(e=>setError(e.message))},[]);
 useEffect(()=>{setCommune("");if(region)listCommunes(region).then(setCommunes).catch(e=>setError(e.message));else setCommunes([])},[region]);
 function locate(){navigator.geolocation?.getCurrentPosition(p=>{setCoords({lat:p.coords.latitude,lng:p.coords.longitude});setLocation(l=>l||"Position GPS enregistrée");},()=>setError("Impossible d’obtenir la position. Vous pouvez renseigner la zone manuellement."),{enableHighAccuracy:true,timeout:10000,maximumAge:60000})}
 function addPhotos(list:FileList|null){const next=[...files,...Array.from(list??[])];if(next.length>5){setError("Maximum 5 photos par signalement.");}setFiles(next.slice(0,5))}
 async function pickVideo(f:File|undefined){setError("");if(!f)return;try{const d=await getVideoDuration(f);if(d>CITIZEN_VIDEO_MAX_SECONDS+0.5){setError(`La vidéo doit durer ${CITIZEN_VIDEO_MAX_SECONDS} secondes maximum (celle-ci dure ${Math.round(d)} s).`);return}setVideo(f)}catch(e){setError(e instanceof Error?e.message:"Vidéo illisible.")}}
 async function submit(e:FormEvent){e.preventDefault();setError("");if(!supabase){setError("Supabase n’est pas configuré.");return}const {data}=await supabase.auth.getUser();if(!data.user){nav("/connexion");return}if(!category){setError("Choisissez une catégorie.");return}if(!region){setError("Choisissez la région du problème.");return}if(!commune){setError("Choisissez la localité du problème.");return}if(!coords){setError("La position GPS est obligatoire pour vérifier qu’un problème n’a pas déjà été signalé à proximité.");return}if(files.length>5){setError("Maximum 5 photos par signalement.");return}setSaving(true);try{const report=await createReport({citizen_id:data.user.id,category_id:category,title:title.trim(),description:description.trim(),location_label:location.trim()||null,latitude:coords?.lat,longitude:coords?.lng,region_id:region,commune_id:commune});for(const file of files)await uploadReportMedia(report.id,file);if(video)await uploadReportMedia(report.id,video);nav("/signalement/"+report.id)}catch(e){setError(e instanceof Error?e.message:"Erreur lors de l’envoi.");}finally{setSaving(false)}}
 return <section className="narrow" data-pcs-tour="report-form"><h1>Faire un signalement</h1><form className="card form" onSubmit={submit}><label>Région du problème<select required value={region} onChange={e=>setRegion(e.target.value)}><option value="">Choisir…</option>{regions.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Localité du problème<select required disabled={!region} value={commune} onChange={e=>setCommune(e.target.value)}><option value="">{region&&!communes.length?"Chargement…":"Choisir…"}</option>{communes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Catégorie<select data-pcs-tour="category" required value={category} onChange={e=>setCategory(e.target.value)}><option value="">Choisir…</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Titre<input required minLength={5} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex. Caniveau bouché"/></label><label>Description<textarea required minLength={10} maxLength={5000} value={description} onChange={e=>setDescription(e.target.value)} rows={5}/></label><label>Zone / adresse<input maxLength={250} value={location} onChange={e=>setLocation(e.target.value)} placeholder="Quartier, rue, repère…"/></label><button type="button" className="button" data-pcs-tour="location" onClick={locate}>Utiliser ma position</button>{coords&&<small>GPS : {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</small>}
  <fieldset className="mediaPicker" data-pcs-tour="photo"><legend>Photos (jusqu’à 5) et vidéo courte ({CITIZEN_VIDEO_MAX_SECONDS} s max)</legend>
   <div className="mediaPickerRow"><label className="mediaPickBtn">📷 Prendre une photo<input hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>{addPhotos(e.target.files);e.target.value=""}}/></label><label className="mediaPickBtn">🖼️ Photos du téléphone<input hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{addPhotos(e.target.files);e.target.value=""}}/></label></div>
   <div className="mediaPickerRow"><label className="mediaPickBtn">🎥 Filmer (10 s)<input hidden type="file" accept="video/mp4,video/webm,video/quicktime" capture="environment" onChange={e=>{void pickVideo(e.target.files?.[0]);e.target.value=""}}/></label><label className="mediaPickBtn">📁 Vidéo du téléphone<input hidden type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e=>{void pickVideo(e.target.files?.[0]);e.target.value=""}}/></label></div>
   {(files.length>0||video)&&<ul className="mediaChosen">{files.map((f,i)=><li key={i}>📷 {f.name}<button type="button" onClick={()=>setFiles(files.filter((_,j)=>j!==i))}>×</button></li>)}{video&&<li>🎥 {video.name}<button type="button" onClick={()=>setVideo(null)}>×</button></li>}</ul>}
  </fieldset>
  {error&&<p className="error">{error}</p>}<button data-pcs-tour="submit-report" disabled={saving} className="button primary" type="submit">{saving?"Envoi en cours…":"Envoyer le signalement"}</button></form></section>
}

export function MyReports(){
 const [reports,setReports]=useState<Report[]>([]);const [error,setError]=useState("");
 useEffect(()=>{(async()=>{if(!supabase){setError("Supabase n’est pas configuré.");return}const {data}=await supabase.auth.getUser();if(!data.user){setError("Connectez-vous pour voir vos signalements.");return}try{setReports(await listMyReports(data.user.id))}catch(e){setError(e instanceof Error?e.message:"Erreur")}})()},[]);
 return <section className="citizenSpace" data-pcs-tour="my-reports-page"><div className="citizenSpaceTop"><div><p className="eyebrow">MON ESPACE</p><h1>Mes signalements</h1></div><Link className="feedPrimary" to="/signaler">＋ Nouveau</Link></div>{error&&<div className="card error">{error}</div>}{!error&&!reports.length&&<div className="citizenEmpty"><strong>Aucun signalement pour le moment.</strong><p>Quand vous signalerez un problème, son suivi apparaîtra ici.</p><Link className="feedPrimary" to="/signaler">Faire mon premier signalement</Link></div>}<div className="citizenReportFeed">{reports.map(r=><article className="citizenReportCard" key={r.id}><div className="reportVisual"><div><span>{r.reference_code}</span><strong>{r.title}</strong><small>{r.location_label??"Localisation GPS enregistrée"}</small></div></div><div className="reportOverlay"><span className="badge" data-pcs-tour="status">{statusLabels[r.status]}</span><p>{r.description}</p><small>{new Date(r.created_at).toLocaleDateString("fr-FR")}</small><Link className="feedPrimary" data-pcs-tour="follow-report" to={"/signalement/"+r.id}>Suivre le signalement</Link></div></article>)}</div></section>
}

export function ProtectedOperations(){const [roles,setRoles]=useState<AppRole[]|null>(null);const location=useLocation();useEffect(()=>{getMyRoles().then(setRoles).catch(()=>setRoles([]))},[]);if(roles===null)return <section className="narrow"><div className="card">Vérification des autorisations…</div></section>;if(!canOperate(roles))return <section className="narrow"><div className="card error">Accès réservé aux utilisateurs habilités.</div><Link to="/">Retour à l’accueil</Link></section>;return location.pathname==="/admin"?<Admin/>:location.pathname==="/dashboard"?<Dashboard/>:<Moderation/>}

function App({children}:{children:React.ReactNode}){
 const logoStyle={"--pcs-logo-url":`url("${pcsLogoUrl}")`} as React.CSSProperties;
 return <div style={logoStyle}><Shell>{children}<OnboardingTour/>{!isSupabaseConfigured&&<div className="dev-banner">Configuration requise : renseignez les variables VITE_SUPABASE_* avant déploiement.</div>}</Shell></div>
}
export default App;

const ORG_SPACES={NIGELEC:{label:"NIGELEC",full:"Société Nigérienne d’Électricité",icon:"⚡",theme:"orgNigelec"},NDE:{label:"NDE",full:"Niger Distribution des Eaux",icon:"💧",theme:"orgNde"}} as const;
export type OrgCode=keyof typeof ORG_SPACES;
export function OrganizationLogin({org}:{org:OrgCode}){
 const space=ORG_SPACES[org];const nav=useNavigate();
 const[signup,setSignup]=useState(false);const[email,setEmail]=useState("");const[pw,setPw]=useState("");const[confirmPw,setConfirmPw]=useState("");const[showPw,setShowPw]=useState(false);const[fullName,setFullName]=useState("");const[error,setError]=useState("");const[info,setInfo]=useState("");const[busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setError("");setInfo("");if(signup&&pw!==confirmPw){setError("Les deux mots de passe ne correspondent pas.");return}if(!supabase){setError("Supabase non configuré.");return}setBusy(true);try{
  if(signup){const {error}=await supabase.auth.signUp({email,password:pw,options:{emailRedirectTo:window.location.origin+(org==="NIGELEC"?"/connexion-nigelec":"/connexion-nde"),data:{full_name:fullName.trim(),requested_organization:org}}});if(error)throw error;await supabase.auth.signOut();setInfo(`Compte ${space.label} créé. Confirmez votre email ; l’accès sera actif dès que votre habilitation ${space.label} aura été enregistrée par un administrateur.`);setSignup(false);setPw("");return}
  const x=await supabase.auth.signInWithPassword({email,password:pw});if(x.error)throw x.error;
  const m=await getMyOrganizationMembership().catch(()=>null);
  if(!m||m.organization?.code?.toUpperCase()!==org){await supabase.auth.signOut();throw new Error(m?`Ce compte appartient à ${m.organization?.name}, pas à ${space.label}.`:`Ce compte n’est pas encore habilité dans l’espace ${space.label}.`)}
  nav("/organisation");
 }catch(e){setError(e instanceof Error?e.message:"Connexion impossible")}finally{setBusy(false)}}
  return <section className={"narrow authScreen orgSpace "+space.theme}><p className="eyebrow">ESPACE {space.label}</p><h1>{space.icon} {signup?`Création de compte ${space.label}`:`Connexion ${space.label}`}</h1><p>{space.full}</p><form className="card form" onSubmit={submit}>{signup&&<label>Nom complet<input required value={fullName} onChange={e=>setFullName(e.target.value)}/></label>}<label>Email professionnel<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label><PasswordField label="Mot de passe" value={pw} onChange={setPw} visible={showPw} onToggle={()=>setShowPw(value=>!value)}/>{signup&&<PasswordField label="Confirmer le mot de passe" value={confirmPw} onChange={setConfirmPw} confirmation visible={showPw} onToggle={()=>setShowPw(value=>!value)}/>} {error&&<p className="error">{error}</p>}{info&&<p>{info}</p>}<button className="button primary" type="submit" disabled={busy}>{busy?"Veuillez patienter…":signup?`Créer mon compte ${space.label}`:"Se connecter"}</button></form><button className="button" onClick={()=>{setSignup(!signup);setError("");setInfo("");setPw("");setConfirmPw("");setShowPw(false)}}>{signup?"J’ai déjà un compte":`Créer un compte ${space.label}`}</button><Link className="button" to="/">Retour</Link></section>
}
