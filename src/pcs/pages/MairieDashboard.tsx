import {useEffect,useMemo,useState} from "react";
import {Link,useNavigate} from "@/pcs/router";
import {supabase} from "../lib/supabase";
import {getMyMairie,listMairieReports,listMyAgents,listActiveOrganizations,transmitReportToOrganization,assignMission,createFieldAgent,updateMairieProfile} from "../services/mairie";
import {statusLabels} from "../types";
import BrandLogo from "../components/BrandLogo";

const statusMeta:any={
 submitted:{label:"Envoyé",tone:"blue"},received:{label:"Reçu",tone:"slate"},
 verification:{label:"Vérification",tone:"amber"},in_progress:{label:"En traitement",tone:"violet"},
 resolved:{label:"Résolu",tone:"green"},rejected:{label:"Rejeté",tone:"red"}
};
function formatDate(v:string){return new Date(v).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});}
function mapsUrl(r:any){return typeof r.latitude==="number"&&typeof r.longitude==="number"?`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`:"#";}

export default function MairieDashboard(){
 const nav=useNavigate();
 const[m,setM]=useState<any>(null),[rows,setRows]=useState<any[]>([]),[agents,setAgents]=useState<any[]>([]),[organizations,setOrganizations]=useState<any[]>([]);
 const[error,setError]=useState(""),[query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[busy,setBusy]=useState(false),[mayorName,setMayorName]=useState(""),[transmitOrg,setTransmitOrg]=useState<Record<string,string>>({});
 const[newAgent,setNewAgent]=useState({first_name:"",last_name:"",matricule:"",qualification:"",phone:"",password:""});
 async function load(){try{const[a,b,c,d]=await Promise.all([getMyMairie(),listMairieReports(),listMyAgents(),listActiveOrganizations()]);if(!a){await supabase?.auth.signOut();nav("/connexion-operationnelle");return;}setM(a);setMayorName(a?.mayor_name??"");setRows(b);setAgents(c);setOrganizations(d);}catch(e){setError(e instanceof Error?e.message:"Erreur de chargement");}}
 useEffect(()=>{
  let active=true;
  const refresh=()=>{if(active&&document.visibilityState==="visible")void load();};
  void load();
  const timer=window.setInterval(refresh,30000);
  window.addEventListener("focus",refresh);
  document.addEventListener("visibilitychange",refresh);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
 },[]);
 async function createAgent(){setError("");setBusy(true);try{await createFieldAgent(newAgent);setNewAgent({first_name:"",last_name:"",matricule:"",qualification:"",phone:"",password:""});await load();}catch(e){setError(e instanceof Error?e.message:"Création impossible");}finally{setBusy(false);}}
 async function assign(r:string,a:string){if(!a)return;setError("");try{await assignMission(r,a);await load();}catch(e){setError(e instanceof Error?e.message:"Affectation impossible");}}
 async function transmit(r:string){const organizationId=transmitOrg[r];if(!organizationId)return;setError("");setBusy(true);try{await transmitReportToOrganization(r,organizationId);setTransmitOrg(v=>({...v,[r]:""}));await load();}catch(e){setError(e instanceof Error?e.message:"Transmission impossible");}finally{setBusy(false);}}
 async function logout(){await supabase?.auth.signOut();nav("/");}
 const stats=useMemo(()=>({total:rows.length,verification:rows.filter(r=>r.status==="verification").length,inProgress:rows.filter(r=>r.status==="in_progress").length,resolved:rows.filter(r=>r.status==="resolved").length,received:rows.filter(r=>r.status==="received"||r.status==="submitted").length}),[rows]);
 const progress=stats.total?Math.round(stats.resolved/stats.total*100):0;
 const filtered=useMemo(()=>rows.filter(r=>{const q=query.trim().toLowerCase();const matches=!q||[r.reference_code,r.title,r.location_label,r.categories?.name].filter(Boolean).join(" ").toLowerCase().includes(q);return matches&&(filter==="all"||r.status===filter);}),[rows,query,filter]);
 const activeAgents=agents.filter(a=>a.is_active),verificationRows=rows.filter(r=>r.status==="verification").slice(0,5);
 return <div className="mairieDashboard">
  <aside className="mairieSidebar">
   <div className="mairieBrand"><BrandLogo className="mairieBrandLogo"/><div><strong>PCS</strong><small>Administration</small></div></div>
   <div className="mairieMenuLabel">MENU</div>
   <nav className="mairieNav">
    <a className="active" href="#dashboard"><span>⌂</span>Tableau de bord</a>
    <a href="#signalements"><span>▣</span>Signalements <b>{stats.total}</b></a>
    <a href="#agents"><span>♙</span>Agents terrain <b>{activeAgents.length}</b></a>
    <a href="#statistiques"><span>◔</span>Statistiques</a>
    <a href="#notifications"><span>◌</span>Notifications</a>
   </nav>
   <div className="mairieMenuLabel">SYSTÈME</div>
   <nav className="mairieNav mairieNavBottom"><a href="#parametres"><span>⚙</span>Paramètres</a><a href="#aide"><span>?</span>Aide</a><button onClick={logout}><span>↪</span>Déconnexion</button></nav>
   <div className="mairieSidebarFooter"><strong>{m?.name??"Mairie"}</strong><span>{m?.regions?.name??"Région non configurée"}</span></div>
  </aside>
  <main className="mairieMain" id="dashboard">
   <header className="mairieTopbar">
    <div className="mairieSearch"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un signalement..." /></div>
    <div className="mairieTopActions"><button className="iconButton" title="Notifications" onClick={()=>document.getElementById("notifications")?.scrollIntoView({behavior:"smooth"})}>♧</button><button className="iconButton" title="Actualiser" onClick={load}>↻</button><div className="mairieProfile"><span className="profileAvatar">{(m?.name??"M").slice(0,1).toUpperCase()}</span><div><strong>{m?.name??"Mairie"}</strong><small>{m?.regions?.name??"Région"}</small></div></div></div>
   </header>
   <section className="mairieContent">
    <div className="mairieWelcome"><div><p className="eyebrow">ESPACE MAIRIE · {m?.regions?.name??"RÉGION"}</p><h1>Tableau de bord</h1><p>Suivez, affectez et contrôlez les signalements de votre région.</p></div><div className="mairieWelcomeActions"><Link className="mairieButton secondary" to="/">Accueil</Link><a className="mairieButton primary" href="#signalements">Voir les signalements</a></div></div>
    {error&&<div className="mairieAlert">{error}<button onClick={()=>setError("")}>×</button></div>}
    <section className="mairieStats">
     <article className="mairieStatCard featured"><div className="statIcon">▣</div><span>Total signalements</span><strong>{stats.total}</strong><small>Dans votre région</small></article>
     <article className="mairieStatCard"><div className="statIcon amber">!</div><span>À vérifier</span><strong>{stats.verification}</strong><small>En attente d'agent</small></article>
     <article className="mairieStatCard"><div className="statIcon violet">↗</div><span>En traitement</span><strong>{stats.inProgress}</strong><small>Missions en cours</small></article>
     <article className="mairieStatCard"><div className="statIcon green">✓</div><span>Résolus</span><strong>{stats.resolved}</strong><small>Traitement terminé</small></article>
    </section>
    <section className="mairieTopGrid">
     <article className="mairiePanel mairieChartPanel" id="statistiques"><div className="panelHead"><div><h2>Répartition des signalements</h2><p>État actuel des dossiers de la région</p></div><span className="panelPeriod">Actualisé à l'instant</span></div>
      <div className="statusBars">{(["verification","in_progress","resolved","received"] as const).map(k=>{const value=k==="verification"?stats.verification:k==="in_progress"?stats.inProgress:k==="resolved"?stats.resolved:stats.received;const width=stats.total?Math.max(value?6:0,Math.round(value/stats.total*100)):0;return <div className="statusBarRow" key={k}><div><span className={`dot ${statusMeta[k].tone}`}></span>{statusMeta[k].label}<b>{value}</b></div><div className="statusBar"><i className={statusMeta[k].tone} style={{width:`${width}%`}}/></div></div>})}</div>
     </article>
     <article className="mairiePanel progressPanel"><div className="panelHead"><div><h2>Progression</h2><p>Signalements résolus</p></div></div><div className="progressRing" style={{["--progress" as any]:`${progress*3.6}deg`}}><div><strong>{progress}%</strong><span>Résolus</span></div></div><div className="progressLegend"><span><i className="dot green"></i>Résolus <b>{stats.resolved}</b></span><span><i className="dot slate"></i>Restants <b>{Math.max(0,stats.total-stats.resolved)}</b></span></div></article>
    </section>
    <section className="mairieMiddleGrid">
     <article className="mairiePanel"><div className="panelHead"><div><h2>À traiter maintenant</h2><p>Signalements nécessitant une affectation terrain</p></div><a href="#signalements" onClick={e=>{e.preventDefault();setFilter("verification")}}>Voir tout</a></div>{verificationRows.length?<div className="priorityList">{verificationRows.map(r=><div className="priorityItem" key={r.id}><div className="priorityMarker amber"></div><div className="priorityBody"><strong>{r.title}</strong><span>{r.reference_code} · {r.location_label??"Localisation GPS enregistrée"}</span></div><Link to={"/signalement/"+r.id}>Ouvrir</Link></div>)}</div>:<div className="mairieEmpty compact">Aucun signalement en attente de vérification.</div>}</article>
     <article className="mairiePanel" id="agents"><div className="panelHead"><div><h2>Agents terrain</h2><p>{activeAgents.length} agent(s) actif(s)</p></div><a href="#create-agent">Ajouter</a></div><div className="agentList">{activeAgents.slice(0,4).map(a=><div className="agentItem" key={a.id}><span className="agentAvatar">{`${a.first_name??""} ${a.last_name??""}`.trim().slice(0,2).toUpperCase()}</span><div><strong>{a.first_name} {a.last_name}</strong><span>{a.qualification||"Agent terrain"} · {a.matricule}</span></div><span className="onlineDot"></span></div>)}{!activeAgents.length&&<div className="mairieEmpty compact">Aucun agent actif.</div>}</div></article>
    </section>
    <section className="mairiePanel reportPanel" id="signalements"><div className="panelHead reportPanelHead"><div><h2>Signalements récents</h2><p>Vue opérationnelle des dossiers de la région</p></div><div className="filterPills">{[["all","Tous"],["verification","À vérifier"],["in_progress","En traitement"],["resolved","Résolus"]].map(([v,l])=><button key={v} className={filter===v?"selected":""} onClick={()=>setFilter(v)}>{l}</button>)}</div></div>
     <div className="tableWrap mairieTableWrap"><table className="mairieTable"><thead><tr><th>Signalement</th><th>Localisation</th><th>Statut</th><th>Affectation</th><th>Transmission</th><th></th></tr></thead><tbody>{filtered.slice(0,10).map(r=><tr key={r.id}><td><div className="reportCell"><strong>{r.reference_code}</strong><span>{r.title}</span><small>{r.categories?.name??"Catégorie"}</small></div></td><td>{r.location_label??"Position GPS"}<br/><small>{formatDate(r.created_at)}</small></td><td><span className={`statusPill ${statusMeta[r.status]?.tone??"slate"}`}>{statusLabels[r.status as keyof typeof statusLabels]??r.status}</span></td><td><select className="agentSelect" defaultValue="" disabled={["resolved","in_progress","verification"].includes(r.status)} onChange={e=>assign(r.id,e.target.value)}><option value="">Affecter...</option>{activeAgents.map(a=><option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}</select></td><td><div className="tableActions"><select className="agentSelect" value={transmitOrg[r.id]??""} disabled={busy||r.status==="resolved"||r.status==="rejected"||!organizations.length} onChange={e=>setTransmitOrg(v=>({...v,[r.id]:e.target.value}))}><option value="">{organizations.length?"Organisation…":"Aucune organisation"}</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select><button className="mairieButton secondary" disabled={busy||!transmitOrg[r.id]||r.status==="resolved"||r.status==="rejected"} onClick={()=>transmit(r.id)}>Transmettre</button></div></td><td><div className="tableActions"><Link to={"/signalement/"+r.id}>Voir</Link>{r.latitude&&r.longitude&&<a href={mapsUrl(r)} target="_blank" rel="noreferrer">Carte</a>}</div></td></tr>)}</tbody></table></div>{!filtered.length&&<div className="mairieEmpty">Aucun signalement ne correspond aux critères.</div>}
    </section>
    <section className="mairiePanel" id="profil-mairie"><div className="panelHead"><div><h2>Profil de la mairie</h2><p>Le compte appartient à la région. Le nom du maire peut être actualisé sans recréer la mairie.</p></div></div><div className="agentFormGrid"><input value={m?.name??""} disabled placeholder="Nom de la mairie"/><input value={m?.regions?.name??""} disabled placeholder="Région"/><input value={mayorName} onChange={e=>setMayorName(e.target.value)} placeholder="Nom du maire"/></div><button className="mairieButton primary" disabled={busy||!mayorName.trim()} onClick={async()=>{setBusy(true);setError("");try{await updateMairieProfile({mayor_name:mayorName});await load()}catch(e){setError(e instanceof Error?e.message:"Mise à jour impossible")}finally{setBusy(false)}}}>{busy?"Enregistrement...":"Enregistrer le maire"}</button></section>
    <section className="mairieBottomGrid">
     <article className="mairiePanel" id="create-agent"><div className="panelHead"><div><h2>Créer un agent terrain</h2><p>L'agent se connecte avec son numéro de téléphone.</p></div></div><div className="agentFormGrid"><input placeholder="Prénom" value={newAgent.first_name} onChange={e=>setNewAgent({...newAgent,first_name:e.target.value})}/><input placeholder="Nom" value={newAgent.last_name} onChange={e=>setNewAgent({...newAgent,last_name:e.target.value})}/><input placeholder="Matricule" value={newAgent.matricule} onChange={e=>setNewAgent({...newAgent,matricule:e.target.value})}/><input placeholder="Qualité / métier" value={newAgent.qualification} onChange={e=>setNewAgent({...newAgent,qualification:e.target.value})}/><input required placeholder="Téléphone *" value={newAgent.phone} onChange={e=>setNewAgent({...newAgent,phone:e.target.value})}/><input required minLength={8} type="password" placeholder="Mot de passe *" value={newAgent.password} onChange={e=>setNewAgent({...newAgent,password:e.target.value})}/></div><button className="mairieButton primary" disabled={busy||!newAgent.phone||newAgent.password.length<8} onClick={createAgent}>{busy?"Création...":"Créer le compte agent"}</button></article>
     <article className="mairiePanel" id="notifications"><div className="panelHead"><div><h2>Contrôle rapide</h2><p>Points d'attention opérationnels</p></div></div><div className="quickChecks"><div><span className="quickIcon amber">!</span><div><strong>{stats.verification} vérification(s)</strong><small>À affecter à un agent terrain</small></div></div><div><span className="quickIcon violet">↗</span><div><strong>{stats.inProgress} mission(s)</strong><small>Actuellement en traitement</small></div></div><div><span className="quickIcon green">✓</span><div><strong>{stats.resolved} résolution(s)</strong><small>Terminée(s) et publiée(s)</small></div></div></div></article>
    </section>
   </section>
  </main>
 </div>;
}
