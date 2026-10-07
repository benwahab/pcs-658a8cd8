import {useEffect,useState} from "react";
import {Link} from "@/pcs/router";
import {supabase} from "../lib/supabase";
import {listMyNotifications,markNotificationRead} from "../services/notifications";

type Notice={id:string;title:string;body:string;read_at:string|null;created_at:string};
export default function Notifications(){
 const [items,setItems]=useState<Notice[]>([]);const [error,setError]=useState("");
 async function load(){if(!supabase){setError("Supabase n’est pas configuré.");return}const {data}=await supabase.auth.getUser();if(!data.user){setError("Connectez-vous pour voir vos notifications.");return}try{setItems(await listMyNotifications(data.user.id) as Notice[])}catch(e){setError(e instanceof Error?e.message:"Erreur")}}
 useEffect(()=>{load()},[]);
 async function read(id:string){await markNotificationRead(id);await load()}
 return <section data-pcs-tour="notifications-page"><div className="sectionHead"><h1>Notifications</h1><Link className="button" to="/">Accueil</Link></div>{error&&<div className="card error">{error}</div>}<div className="grid">{items.map(n=><article data-pcs-tour="notification-item" className={n.read_at?"card":"card unread"} key={n.id}><div className="row"><strong>{n.title}</strong><small>{new Date(n.created_at).toLocaleString("fr-FR")}</small></div><p>{n.body}</p>{!n.read_at&&<button className="button" onClick={()=>read(n.id)}>Marquer comme lue</button>}</article>)}</div>{!error&&!items.length&&<div className="empty">Aucune notification.</div>}</section>
}