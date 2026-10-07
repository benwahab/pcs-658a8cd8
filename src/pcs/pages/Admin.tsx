import {useEffect,useState} from "react";
import {Link} from "@/pcs/router";
import {assignReport,listAllReports,listAssignableAgents,listDepartments,updateReportPriority,updateReportStatus,listOrganizationSignupRequests,approveOrganizationSignupRequest,rejectOrganizationSignupRequest,type OrganizationSignupRequest} from "../services/admin";
import {statusLabels,type ReportPriority,type ReportStatus} from "../types";

type Row={id:string;reference_code:string;title:string;status:ReportStatus;priority:ReportPriority;created_at:string;department_id:string|null;categories?:{name:string}|null;departments?:{name:string}|null};
const nextStatuses:Record<ReportStatus,ReportStatus[]>={submitted:["received","rejected"],received:["verification","rejected"],verification:["in_progress","rejected"],in_progress:["resolved","rejected"],resolved:["in_progress"],rejected:["received"]};

export default function Admin(){
 const [rows,setRows]=useState<Row[]>([]);const [departments,setDepartments]=useState<any[]>([]);const [agents,setAgents]=useState<any[]>([]);const [orgRequests,setOrgRequests]=useState<OrganizationSignupRequest[]>([]);const [mairieRequests,setMairieRequests]=useState<MairieSignupRequest[]>([]);const [error,setError]=useState("");const [loadErrors,setLoadErrors]=useState<Record<string,string>>({});
 async function load(){const results=await Promise.allSettled([listAllReports(),listOrganizationSignupRequests()]);const nextErrors:Record<string,string>={};const [reportsResult,orgResult]=results;if(reportsResult.status==="fulfilled")setRows(reportsResult.value as Row[]);else nextErrors.reports=reportsResult.reason instanceof Error?reportsResult.reason.message:"Chargement des signalements impossible.";if(orgResult.status==="fulfilled")setOrgRequests(orgResult.value);else nextErrors.organizations=orgResult.reason instanceof Error?orgResult.reason.message:"Chargement des demandes NIGELEC/NDE impossible.";mairieResult.reason instanceof Error?mairieResult.reason.message:"Chargement des demandes mairie impossible.";setLoadErrors(nextErrors)}
 useEffect(()=>{load();Promise.all([listDepartments(),listAssignableAgents()]).then(([d,a])=>{setDepartments(d);setAgents(a)}).catch(e=>setError(e.message))},[]);
 async function status(id:string,value:ReportStatus){setError("");try{await updateReportStatus(id,value);await load()}catch(e){setError(e instanceof Error?e.message:"Transition refusée.")}}
 async function priority(id:string,value:ReportPriority){setError("");try{await updateReportPriority(id,value);await load()}catch(e){setError(e instanceof Error?e.message:"Mise à jour impossible.")}}

