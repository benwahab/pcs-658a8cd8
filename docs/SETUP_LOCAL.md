# Installation locale

## Prérequis
Node.js récent et npm.

## Installation
npm install

## Configuration
Copier `.env.example` vers `.env.local` puis renseigner:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

## Démarrage
npm run dev

## Production
npm run build

Le backend PCS doit être un projet Supabase dédié. Ne pas utiliser accidentellement le backend d’un autre produit.