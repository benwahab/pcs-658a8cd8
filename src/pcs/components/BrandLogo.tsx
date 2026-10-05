import type {CSSProperties} from "react";
const pcsLogoUrl = "/assets/pcs-logo.jpg";

export default function BrandLogo({className="",alt="PCS — Plateforme Citoyenne de Signalement",style}:{className?:string;alt?:string;style?:CSSProperties}){
 return <img className={className} src={pcsLogoUrl} alt={alt} style={style} draggable={false}/>;
}
