import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  return new Response(JSON.stringify({
    error:"Cet endpoint d’ajout de vidéo citoyenne est retiré. Les signalements citoyens sont désormais totalement anonymes et leurs médias sont envoyés via citizen-report-submit."
  }),{
    status:410,
    headers:{...cors,"Content-Type":"application/json"}
  });
});
