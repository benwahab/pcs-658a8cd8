export type ReportStatus="submitted"|"received"|"verification"|"in_progress"|"resolved"|"rejected";
export type ReportPriority="low"|"normal"|"high"|"urgent";
export interface Category{id:string;name:string;slug:string}
export interface Region{id:string;name:string;code:string|null;geoname_id:number|null}
export interface Mairie{id:string;name:string;mayor_name:string|null;region_id:string;commune_id:string;account_user_id:string|null;phone:string|null;latitude:number|null;longitude:number|null;location_label:string|null;is_active:boolean}
export interface FieldAgent{id:string;user_id:string;mairie_id:string;first_name:string;last_name:string;matricule:string;qualification:string;phone:string|null;is_active:boolean}
export interface Report{id:string;reference_code:string;citizen_id:string;title:string;description:string;status:ReportStatus;priority:ReportPriority;category_id:string;department_id:string|null;region_id:string|null;commune_id:string|null;latitude:number|null;longitude:number|null;created_at:string;updated_at:string;resolved_at:string|null;location_label:string|null;resolution_note:string|null}
export interface PublicReport {
 id:string|null;
 reference_code:string|null;
 title:string|null;
 description:string|null;
 status:ReportStatus|null;
 priority:ReportPriority|null;
 category_id:string|null;
 department_id:string|null;
 region_id:string|null;
 commune_id:string|null;
 latitude:number|null;
 longitude:number|null;
 created_at:string|null;
 updated_at:string|null;
 resolved_at:string|null;
 location_label:string|null;
 resolution_note:string|null;
}
export const statusLabels:Record<ReportStatus,string>={submitted:"Envoyé",received:"Reçu",verification:"Vérification du signalement",in_progress:"En cours de traitement",resolved:"Résolu",rejected:"Rejeté"};
export const priorityLabels:Record<ReportPriority,string>={low:"Faible",normal:"Normale",high:"Haute",urgent:"Urgente"};