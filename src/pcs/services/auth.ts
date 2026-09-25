import { supabase } from "../lib/supabase";

export async function getCurrentUser(){
  if(!supabase)return null;
  const {data}=await supabase.auth.getUser();
  return data.user??null;
}
export async function signOut(){
  if(!supabase)return;
  const {error}=await supabase.auth.signOut();
  if(error)throw error;
}