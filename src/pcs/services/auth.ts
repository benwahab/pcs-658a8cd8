import { supabase } from "../lib/supabase";
import { clearCachedAgentMissions } from "./offline";

export async function getCurrentUser(){
  if(!supabase)return null;
  const {data}=await supabase.auth.getUser();
  return data.user??null;
}
export async function signOut(){
  if(!supabase){
    clearCachedAgentMissions();
    return;
  }
  const {error}=await supabase.auth.signOut();
  if(error)throw error;
  clearCachedAgentMissions();
}