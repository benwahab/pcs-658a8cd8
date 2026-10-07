import { supabase } from "../lib/supabase";
import { clearCachedAgentMissions } from "./offline";
export async function getCurrentUser(){if(!supabase)return null;const {data}=await supabase.auth.getUser();return data.user??null;}
export async function signOut(){if(!supabase)return;const {data}=await supabase.auth.getUser();const {error}=await supabase.auth.signOut();if(error)throw error;if(data.user?.id)clearCachedAgentMissions(data.user.id);}
