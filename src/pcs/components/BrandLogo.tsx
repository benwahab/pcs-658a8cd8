import type {CSSProperties} from "react";
import pcsLogo from "@/assets/pcs-logo.png.asset.json";

export default function BrandLogo({className="",alt="PCS — Plateforme Citoyenne de Signalement",style}:{className?:string;alt?:string;style?:CSSProperties}){
 return <img className={className} src={pcsLogo.url} alt={alt} style={style} draggable={false}/>;
}
