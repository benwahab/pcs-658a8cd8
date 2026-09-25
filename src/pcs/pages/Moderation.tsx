import {useEffect,useState} from "react";
import {Link} from "@/pcs/router";
import {addInternalComment,listAllReports} from "../services/admin";
type Row={id:string;reference_code:string;title:string;description:string;status:string};
export default function Moderation(){
 const [rows,setRows]=useState<Row[]>([]);const [error,setError]=useState("");const [comment,setComment]=useState<Record<string,string>>({});const [saving,setSaving]=useState<string|null>(null);
 async function load(){try{setRows(await listAllReports() as Row[])}catch(e){setError(e instanceof Error?e.message:"Accès refusé.")}}
 useEffect(()=>{load()},[]);
 async function save(id:string){const body=(comment[id]??"").trim();if(!body)return;setSaving(id);setError("");try{await addInternalComment(id,body);setComment(v=>({...v,[id]:""}))}catch(e){setError(e instanceof Error?e.message:"Impossible d’enregistrer la note.")}finally{setSaving(null)}}
 return <section><div className="sectionHead"><div><p className="eyebrow">CONTRÔLE DU CONTENU</p><h1>Modération</h1></div><Link className="button" to="/admin">Traitement</Link></div>{error&&<div className="card error">{error}</div>}<div className="grid">{rows.map(r=><article className="card" key={r.id}><strong>{r.reference_code}</strong><h3>{r.title}</h3><p>{r.description}</p><small>Statut : {r.status}</small><label className="form" style={{marginTop:16}}>Note interne<textarea rows={3} value={comment[r.id]??""} onChange={e=>setComment(v=>({...v,[r.id]:e.target.value}))} placeholder="Motif, vérification, consigne…"/></label><button className="button" disabled={saving===r.id||!(comment[r.id]??"").trim()} onClick={()=>save(r.id)}>{saving===r.id?"Enregistrement…":"Ajouter la note"}</button></article>)}</div></section>
}
