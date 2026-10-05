import {useEffect,useRef} from "react";
import {useLocation} from "@/pcs/router";
import {driver,type DriveStep} from "driver.js";
import "driver.js/dist/driver.css";

const STORAGE_KEY="pcs_onboarding_v1_completed";

function visibleElement(selector:string){
 const el=document.querySelector(selector) as HTMLElement|null;
 if(!el)return null;
 const style=window.getComputedStyle(el);
 const rect=el.getBoundingClientRect();
 return style.display!=="none"&&style.visibility!=="hidden"&&rect.width>0&&rect.height>0?el:null;
}

function stepsFor(pathname:string):DriveStep[]{
 const step=(element:string,title:string,description:string,side?:NonNullable<DriveStep["popover"]>["side"]):DriveStep=>({
  element,
  waitForElement:2500,
  skipMissingElement:true,
  popover:{title,description,side}
 });
 if(pathname==="/"){
  return [
   step('[data-pcs-tour="home"]',"Bienvenue sur PCS","Depuis l’accueil, vous découvrez les signalements d’intérêt public publiés sur la plateforme."),
   step('[data-pcs-tour="create-report"]',"Créer un signalement","Utilisez ce bouton pour signaler un problème d’intérêt public. Votre signalement sera géolocalisé et suivi."),
   step('[data-pcs-tour="my-reports"]',"Suivre vos signalements","Cette entrée vous permet de retrouver vos signalements et de suivre leur évolution."),
   step('[data-pcs-tour="status"]',"Voir le statut","Chaque signalement affiche son statut pour vous permettre de savoir où en est sa prise en charge."),
   step('[data-pcs-tour="notifications"]',"Recevoir les notifications","Retrouvez ici les informations liées à l’évolution de vos signalements."),
   step('[data-pcs-tour="professional-access"]',"Accès aux espaces professionnels","Cet accès mène aux espaces Mairie, Agent terrain, NIGELEC et NDE.")
  ];
 }
 if(pathname==="/signaler"){
  return [
   step('[data-pcs-tour="report-form"]',"Créer votre signalement","Remplissez les informations du problème. PCS utilise ces données pour orienter et suivre le signalement."),
   step('[data-pcs-tour="category"]',"Choisir une catégorie","Sélectionnez la catégorie qui correspond au problème rencontré."),
   step('[data-pcs-tour="location"]',"Localiser le problème","La position GPS est obligatoire afin de localiser précisément le problème et d’éviter les doublons à proximité."),
   step('[data-pcs-tour="photo"]',"Ajouter une photo","Vous pouvez joindre des photos du problème pour faciliter son identification et sa prise en charge."),
   step('[data-pcs-tour="submit-report"]',"Envoyer le signalement","Quand les informations sont complètes, envoyez le signalement pour commencer son suivi.")
  ];
 }
 if(pathname==="/mes-signalements"){
  return [
   step('[data-pcs-tour="my-reports-page"]',"Mes signalements","Cet espace regroupe les signalements que vous avez créés."),
   step('[data-pcs-tour="status"]',"Suivre le statut","Le statut visible sur chaque signalement indique son étape actuelle."),
   step('[data-pcs-tour="follow-report"]',"Ouvrir le suivi","Ouvrez un signalement pour consulter ses détails, son historique et sa résolution lorsqu’elle est disponible.")
  ];
 }
 if(pathname==="/notifications"){
  return [
   step('[data-pcs-tour="notifications-page"]',"Vos notifications","Les notifications vous informent des changements concernant vos signalements."),
   step('[data-pcs-tour="notification-item"]',"Lire une notification","Une notification non lue peut être marquée comme lue directement depuis cette page.")
  ];
 }
 return [
  step('[data-pcs-tour="account"]',"Votre compte","Votre session PCS est affichée ici lorsque vous êtes connecté."),
  step('[data-pcs-tour="app-nav"]',"Navigation PCS","Utilisez cette navigation pour revenir à l’accueil, créer un signalement et accéder à vos informations de suivi.")
 ];
}

export default function OnboardingTour(){
 const location=useLocation();
 const startedRef=useRef(false);
 const driverRef=useRef<ReturnType<typeof driver>|null>(null);

 useEffect(()=>{
  if(startedRef.current||localStorage.getItem(STORAGE_KEY)==="true")return;
  // Never start the tour while the PCS splash is visible.
  // The splash marks the DOM when its fixed 5000 ms display has completed.
  if(document.documentElement.dataset.pcsSplashReady !== "true")return;
  const isCitizenRoute=["/","/signaler","/mes-signalements","/notifications"].includes(location.pathname)||location.pathname.startsWith("/signalement/");
  if(!isCitizenRoute)return;

  let cancelled=false;
  const timer=window.setInterval(()=>{
   if(cancelled||startedRef.current)return;
   const configured=stepsFor(location.pathname);
   // Start only when every configured tour target is actually rendered.
   // Starting with a partial list makes Driver.js treat the first available
   // element as the last step and can show "Terminer" immediately.
   const available=configured.filter(s=>typeof s.element==="string"&&visibleElement(s.element as string));
   if(available.length !== configured.length)return;
   startedRef.current=true;
   window.clearInterval(timer);

   const finish=()=>{
    localStorage.setItem(STORAGE_KEY,"true");
    window.dispatchEvent(new Event("pcs-onboarding-completed"));
    driverRef.current?.destroy();
    driverRef.current=null;
   };

   const instance=driver({
    steps:available,
    animate:true,
    duration:280,
    smoothScroll:true,
    allowClose:true,
    allowScroll:true,
    overlayOpacity:.68,
    stagePadding:8,
    stageRadius:10,
    popoverOffset:12,
    popoverClass:"pcs-onboarding-popover",
    showButtons:["previous","next","close"],
    showProgress:true,
    progressText:"{{current}} sur {{total}}",
    nextBtnText:"Suivant",
    prevBtnText:"Précédent",
    doneBtnText:"Terminer",
    skipMissingElement:true,
    waitForElement:2500,
    onPopoverRender:(popover)=>{
     if(popover.footerButtons.querySelector(".pcs-onboarding-skip"))return;
     const skip=document.createElement("button");
     skip.type="button";
     skip.className="driver-popover-footer-btn pcs-onboarding-skip";
     skip.textContent="Passer le guide";
     skip.addEventListener("click",finish,{once:true});
     popover.footerButtons.insertBefore(skip,popover.footerButtons.firstChild);
    },
    onNextClick:(_element,_step,{driver:instance})=>{
     if(instance.isLastStep())finish();
     else instance.moveNext();
    },
    onDoneClick:finish,
    onCloseClick:finish,
    onDestroyed:()=>{driverRef.current=null}
   });
   driverRef.current=instance;
   instance.drive();
  },120);

  const onSplashCompleted=()=>{
   // The splash can finish after this component mounted; retry immediately.
   startedRef.current=false;
  };
  window.addEventListener("pcs-splash-completed",onSplashCompleted);

  return()=>{
   cancelled=true;
   window.clearInterval(timer);
   window.removeEventListener("pcs-splash-completed",onSplashCompleted);
   if(driverRef.current?.isActive())driverRef.current.destroy();
   driverRef.current=null;
  };
 },[location.pathname]);

 return null;
}
