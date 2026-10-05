import type {CSSProperties} from "react";
import {url as pcsLogoUrl} from "@/assets/pcs-logo.png.asset.json";

export default function BrandLogo({className="",alt="PCS — Plateforme Citoyenne de Signalement",style}:{className?:string;alt?:string;style?:CSSProperties}){
 return <img className={className} src={pcsLogoUrl} alt={alt} style={style} draggable={false}/>;
}
